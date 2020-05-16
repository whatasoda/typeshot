import ts from 'typescript';
import prettier from 'prettier';
import path from 'path';
import { parsePreTypeEntries, splitStatements, COMMENT_NODES, parseDefaultTypeshotExpression } from './parsers';
import { createTypeshotStatementFromEntry, updateImportPath } from './ast-utils';
import { serializeEntry } from './serialize';
import type { ProgramConfig } from './decls';
import runSourceWithContext, { TypeshotContext } from '../context';
import '../typeshot';

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

    const program = ts.createProgram({ host, rootNames, options, projectReferences });
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

  const sections = splitStatements(source);
  const types = parsePreTypeEntries(sections['main']);
  if (!types) {
    // eslint-disable-next-line no-console
    console.warn(`'${source.fileName}' has been skipped. Check usage of 'typeshot' in the file.`);
    return null;
  }

  const context = runSourceWithContext(source, options, { types, entries: [] });
  const statements = context.entries.map(createTypeshotStatementFromEntry);

  const contentText = printer.printFile(
    ts.updateSourceFileNode(
      source,
      ts.createNodeArray([
        ...sections['output-header'],
        ...sections['header'],
        COMMENT_NODES['main'],
        ...statements,
        ...sections['footer'],
        ...sections['output-footer'],
      ]),
      false,
    ),
  );

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

const handlePostSource = (relay: Relay, program: ts.Program, checker: ts.TypeChecker, printer: ts.Printer) => {
  const { fileName, context, destinationDir, sourceDir } = relay;
  const source = program.getSourceFile(fileName);
  if (!source || source.isDeclarationFile) return;

  const sections = splitStatements(source);
  const types = new Map<string, ts.TypeNode>();
  sections['main'].forEach((stmt) => {
    const entry = parseDefaultTypeshotExpression(stmt);
    if (entry) types.set(entry.key, entry.type);
  });

  if (!types.size) {
    // eslint-disable-next-line no-console
    console.warn(`'${source.fileName}' has been skipped. Check usage of 'typeshot' in the file.`);
    return;
  }

  const outputHeaders = sections['output-header'].map((s) => updateImportPath(s, sourceDir, destinationDir));
  const outputFooters = sections['output-footer'].map((s) => updateImportPath(s, sourceDir, destinationDir));

  return [
    context.header || '',
    printer.printList(ts.ListFormat.None, ts.createNodeArray(outputHeaders), source),
    context.entries
      .map((entry) => {
        const type = types.get(entry.key);
        return type ? serializeEntry({ ...entry, type }, checker, printer) : '';
      })
      .join(''),
    printer.printList(ts.ListFormat.None, ts.createNodeArray(outputFooters), source),
    '\nexport {};\n',
  ].join('');
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
