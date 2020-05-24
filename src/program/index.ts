import ts from 'typescript';
import prettier from 'prettier';
import path from 'path';
import { serializeTemplate } from './serialize';
import { createTransformHost } from './transform';
import { getGenerationRange } from './separator';
import { forEachChildrenDeep } from './ast-utils';
import { handleTypeshotMethod } from './resolvers/typeshot-method';
import { createIntermediateType, parseIntermediateType } from './resolvers/intermediate-type';
import { createModulePathResolver, isTypeshotImportDeclaration } from './resolvers/import-path';
import runSourceWithContext, { TypeshotContext, TypeInformation, TypeRequest } from '../context';
import '../typeshot';

export interface ProgramConfig {
  test: RegExp;
  files?: boolean;
  project?: string;
  basePath?: string;
  prettierOptions?: prettier.Options;
}

interface Relay {
  fileName: string;
  context: TypeshotContext;
  contentText: string;
  destination: string;
  destinationDir: string;
  sourceDir: string;
}

const runTypeshot = (programConfig: ProgramConfig, sys: ts.System = ts.sys) => {
  const { basePath = process.cwd(), project = `${basePath}/tsconfig.json` } = programConfig;
  const prettierOptions = programConfig.prettierOptions || getPrettierOptions(basePath, sys);

  const formatHost: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (path) => path,
    getCurrentDirectory: sys.getCurrentDirectory,
    getNewLine: () => sys.newLine,
  };

  const printer = ts.createPrinter();
  const tsconfig = loadTsconfig(basePath, project, sys, formatHost);
  const { options, projectReferences } = tsconfig;

  const entrypoints = tsconfig.fileNames.filter((file) => programConfig.test.test(file));

  const relays = new Map<string, Relay>();
  entrypoints.forEach((fileName) => {
    const sourceText = sys.readFile(fileName, 'utf-8');
    const relay = sourceText && handleEntrypoint(fileName, sourceText, options, printer);
    if (!relay) return;
    relays.set(fileName, relay);
  });

  if (!relays.size) return;
  const host = ts.createCompilerHost(options, true);
  const readFile = host.readFile;
  host.readFile = (fileName: string) => relays.get(fileName)?.contentText || readFile(fileName);

  const program = ts.createProgram({
    host,
    options,
    projectReferences,
    rootNames: programConfig.files ? tsconfig.fileNames : entrypoints,
  });
  const checker = program.getTypeChecker();

  relays.forEach((relay) => {
    let content = handleIntermediateFile(relay, program, checker, printer);
    if (!content) return;
    try {
      content = prettier.format(content, { ...prettierOptions, parser: 'typescript' });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(e);
    }
    sys.writeFile(relay.destination, content);
  });
};

const handleEntrypoint = (
  fileName: string,
  sourceText: string,
  options: ts.CompilerOptions,
  printer: ts.Printer,
): Relay | null => {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (source.isDeclarationFile) return null;

  const [replaceOnExecution, createExecutableCode] = createTransformHost();
  const [replaceOnIntermediateFile, createIntermediateFile] = createTransformHost();

  const types = new Map<string, TypeInformation>();
  forEachChildrenDeep(source, (node) => {
    const isMethod = handleTypeshotMethod(types, node, replaceOnExecution, replaceOnIntermediateFile);
    if (isMethod) return;

    if (isTypeshotImportDeclaration(node)) {
      replaceOnIntermediateFile(node.pos, node.end, '');
    }
  });

  if (!types.size) {
    // eslint-disable-next-line no-console
    console.warn(`'${source.fileName}' has been skipped. Check usage of 'typeshot' in the file.`);
    return null;
  }

  const codeToExecute = createExecutableCode(sourceText);
  const context = runSourceWithContext(source, codeToExecute, options, {
    getType: (id) => types.get(id),
    template: [],
    requests: new Map<string, TypeRequest>(),
  });

  const intermediate = printer.printNode(ts.EmitHint.Unspecified, createIntermediateType(context.requests), source);

  replaceOnIntermediateFile(sourceText.length, sourceText.length, `${intermediate}\n`);
  const contentText = createIntermediateFile(sourceText);

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

const handleIntermediateFile = (relay: Relay, program: ts.Program, checker: ts.TypeChecker, printer: ts.Printer) => {
  const { fileName, context, destinationDir, sourceDir } = relay;
  const source = program.getSourceFile(fileName);
  if (!source || source.isDeclarationFile) return;

  const [replaceOnOutput, createOutput] = createTransformHost();
  if (context.header) replaceOnOutput(0, 0, `${context.header}\n`);

  const intermediateTypes = parseIntermediateType(source.statements[source.statements.length - 1], replaceOnOutput);
  if (!intermediateTypes.size) {
    // eslint-disable-next-line no-console
    console.warn(`'${source.fileName}' has been skipped. Check usage of 'typeshot' in the file.`);
    return;
  }

  const fullText = source.getFullText();

  const [start, end] = getGenerationRange(fullText);
  replaceOnOutput(start, end, serializeTemplate(context.template, intermediateTypes, checker, printer));

  const resolveModulePath = createModulePathResolver(replaceOnOutput, sourceDir, destinationDir);
  forEachChildrenDeep(source, (node) => {
    resolveModulePath(node);
  });

  replaceOnOutput(fullText.length, fullText.length, '\nexport {};\n');

  return createOutput(fullText);
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
