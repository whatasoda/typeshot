import ts from 'typescript';
import prettier from 'prettier';
import path from 'path';
import { parseTypeshotMethods, getModulePathNode } from './parsers';
import { createIntermediateType, isTypeshotImportDeclaration } from './ast-utils';
import { serializeEntry } from './serialize';
import type { ProgramConfig, TypeInformation } from './decls';
import runSourceWithContext, { TypeshotContext } from '../context';
import '../typeshot';
import { Replacement, transformSourceText } from './transform';
import typeshot from '../typeshot';

interface Relay {
  fileName: string;
  context: TypeshotContext;
  contentText: string;
  destination: string;
  destinationDir: string;
  sourceDir: string;
}

const runTypeshot = (typeshotConfig: ProgramConfig, sys: ts.System = ts.sys) => {
  const { basePath = process.cwd(), project = `${basePath}/tsconfig.json` } = typeshotConfig;
  const prettierOptions = typeshotConfig.prettierOptions || getPrettierOptions(basePath, sys);

  const formatHost: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (path) => path,
    getCurrentDirectory: sys.getCurrentDirectory,
    getNewLine: () => sys.newLine,
  };

  const printer = ts.createPrinter();
  const tsconfig = loadTsconfig(basePath, project, sys, formatHost);
  const { options, projectReferences } = tsconfig;

  const rootNames = tsconfig.fileNames.filter((file) => typeshotConfig.test.test(file));

  const messages: string[] = [];

  const Relays = new Map<string, Relay>();
  rootNames.forEach((fileName) => {
    const sourceText = sys.readFile(fileName, 'utf-8');
    const relay = sourceText && handlePreSource(fileName, sourceText, options, printer);
    if (!relay) return;
    Relays.set(fileName, relay);
  });

  if (Relays.size) {
    const host = ts.createCompilerHost(options, true);
    const readFile = host.readFile;
    host.readFile = (fileName: string) => Relays.get(fileName)?.contentText || readFile(fileName);

    const program = ts.createProgram({ host, rootNames: tsconfig.fileNames, options, projectReferences });
    const checker = program.getTypeChecker();

    Relays.forEach((relay) => {
      const { destination: snapshotPath } = relay;
      const content = handlePostSource(relay, program, checker, printer);
      if (!content) return;
      sys.writeFile(snapshotPath, prettier.format(content, { ...prettierOptions, parser: 'typescript' }));
    });
  }

  // eslint-disable-next-line no-console
  messages.forEach(console.log);
};

const handlePreSource = (
  fileName: string,
  sourceText: string,
  options: ts.CompilerOptions,
  printer: ts.Printer,
): Relay | null => {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (source.isDeclarationFile) return null;

  const replaceOnExecution: Replacement[] = [];
  const replaceOnIntermediate: Replacement[] = [];

  let currKey = 0;

  const keyInjectionIndex: Partial<Record<keyof typeof typeshot, number>> = {
    createDynamic: 0,
    takeStatic: 1,
  };
  const types = new Map<string, TypeInformation>();
  source.statements.forEach((statement) => {
    const parsed = parseTypeshotMethods(statement);
    if (parsed) {
      const { method, expression, typeArguments, arguments: args } = parsed;
      replaceOnIntermediate[statement.pos] = { end: statement.end, text: '' };

      if (method in keyInjectionIndex) {
        const index = keyInjectionIndex[method]!;
        if (args.length !== index) {
          throw new Error(`Expected ${index} args, but got ${args.length}.`);
        }

        const pos = expression.end - 1;
        const key = `${currKey++}`;
        const [type] = typeArguments;
        replaceOnExecution[pos] = { end: pos, text: `, '${key}'` };
        types.set(key, { key, type });
      }
    } else if (isTypeshotImportDeclaration(statement)) {
      replaceOnIntermediate[statement.pos] = { end: statement.end, text: '' };
    }
  });

  if (!types.size) {
    // eslint-disable-next-line no-console
    console.warn(`'${source.fileName}' has been skipped. Check usage of 'typeshot' in the file.`);
    return null;
  }

  const codeToExecute = transformSourceText(sourceText, replaceOnExecution);
  const context = runSourceWithContext(source, codeToExecute, options, { types, entries: [] });

  const intermediate = printer.printNode(ts.EmitHint.Unspecified, createIntermediateType(context.entries), source);

  replaceOnIntermediate[sourceText.length] = { end: sourceText.length, text: `${intermediate}\n` };
  const contentText = transformSourceText(sourceText, replaceOnIntermediate);

  const output = context.config?.output;
  const { dir: sourceDir, name } = path.parse(fileName);
  const destination = output
    ? path.isAbsolute(output)
      ? output
      : path.resolve(sourceDir, output)
    : path.join(sourceDir, '__snapshot__', `${name}.snapshot`);
  const { dir: destinationDir } = path.parse(destination);

  return { fileName, context, contentText, destination, sourceDir, destinationDir };
};
const START = /^\s*?\/\/ typeshot-start ?.*?$/m;
const END = /^\s*?\/\/ typeshot-end ?.*?$/m;

const handlePostSource = (relay: Relay, program: ts.Program, checker: ts.TypeChecker, printer: ts.Printer) => {
  const { fileName, context, destinationDir, sourceDir } = relay;
  const source = program.getSourceFile(fileName);
  if (!source || source.isDeclarationFile) return;

  const replaceOnOutput: Replacement[] = [{ end: 0, text: context.header ? `${context.header}\n` : '' }];
  const types = new Map<string, ts.TypeNode>();
  const last = source.statements[source.statements.length - 1];
  if (ts.isInterfaceDeclaration(last) && last.name.text === '__TYPESHOT_INTERMEDIATE__') {
    replaceOnOutput[last.pos] = { end: last.end, text: '' };
    last.members.forEach((member) => {
      if (ts.isPropertySignature(member) && ts.isStringLiteral(member.name) && member.type) {
        types.set(member.name.text, member.type);
      }
    });
  }

  if (!types.size) {
    // eslint-disable-next-line no-console
    console.warn(`'${source.fileName}' has been skipped. Check usage of 'typeshot' in the file.`);
    return;
  }

  const resolveRelativeImport = (modulePath: string) => {
    if (!modulePath.startsWith('.')) return modulePath;
    const resolved = path.relative(destinationDir, path.resolve(sourceDir, modulePath));
    return resolved.startsWith('.') ? resolved : `./${resolved}`;
  };

  const fullText = source.getFullText();
  const start = fullText.match(START);
  const end = fullText.match(END);

  replaceOnOutput[start && typeof start.index !== 'undefined' ? start.index + start[0].length : 0] = {
    end: end && typeof end.index !== 'undefined' ? end.index - 1 : fullText.length,
    text: context.entries
      .map((entry) => {
        const type = types.get(entry.key);
        return type ? serializeEntry({ ...entry, type }, checker, printer) : '';
      })
      .join(''),
  };
  replaceOnOutput[fullText.length] = { end: fullText.length, text: '\nexport {};\n' };

  const queue: ts.Node[] = [...source.statements];
  while (queue.length) {
    const node = queue.shift()!;
    const modulePathNode = getModulePathNode(node);
    if (modulePathNode) {
      const pos = modulePathNode.end - modulePathNode.text.length - 1;
      const end = modulePathNode.end - 1;
      replaceOnOutput[pos] = { end, text: resolveRelativeImport };
    }

    node.forEachChild((child) => void queue.push(child));
  }

  return transformSourceText(fullText, replaceOnOutput);
};

const getPrettierOptions = (basePath: string, sys: ts.System) => {
  const prettierrc = path.resolve(basePath, '.prettierrc');
  try {
    if (sys.fileExists(prettierrc)) return JSON.parse(sys.readFile(prettierrc)!) as prettier.Options;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
  }
  return;
};

const loadTsconfig = (basePath: string, project: string, sys: ts.System, formatHost: ts.FormatDiagnosticsHost) => {
  const configContent = ts.readConfigFile(project, sys.readFile);
  if (configContent.error) {
    // eslint-disable-next-line no-console
    console.error(ts.formatDiagnostic(configContent.error, formatHost));
    process.exit(1);
  }

  const tsconfig = ts.parseJsonConfigFileContent(configContent.config, sys, basePath);
  if (tsconfig.errors.length) {
    // eslint-disable-next-line no-console
    console.error(ts.formatDiagnostics(tsconfig.errors, formatHost));
    process.exit(1);
  }

  return tsconfig;
};

export default runTypeshot;
