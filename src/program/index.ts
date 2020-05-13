import ts from 'typescript';
import prettier from 'prettier';
import path from 'path';
import { parseTypeEntriesFromStatements, splitStatements, COMMENT_NODES } from './parsers';
import {
  createTypeshotStatementFromEntry,
  updateImportPath,
  TypeshotImportDeclaration,
  isTypeshotImportDeclaration,
} from './ast-utils';
import { serializeEntry } from './serialize';
import type { ProgramConfig } from './decls';
import runSourceWithContext from '../context';
import '../typeshot';

interface Relay {
  header: string;
  content: string;
  tempFilePath: string;
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
  const program = createTSProgram(basePath, project, sys, formatHost);
  program.getTypeChecker();

  const messages: string[] = [];
  const entrypoints = program.getRootFileNames().filter((file) => typeshotConfig.test.test(file));

  const relays: Relay[] = [];
  const extraFiles: string[] = [];
  entrypoints.forEach((entrypoint) => {
    const relay = handlePreSource(entrypoint, program, printer);
    if (relay) {
      const { tempFilePath, content } = relay;
      relays.push(relay);
      extraFiles.push(tempFilePath);
      sys.writeFile(tempFilePath, content);
      process.addListener('exit', () => sys.deleteFile?.(tempFilePath));
    }
  });

  if (relays.length) {
    const program = createTSProgram(basePath, project, sys, formatHost, extraFiles);
    const checker = program.getTypeChecker();

    relays.forEach((relay) => {
      const { destination: snapshotPath } = relay;
      const content = handlePostSource(relay, program, checker, printer);
      if (!content) return;
      sys.writeFile(snapshotPath, prettier.format(content, { ...prettierOptions, parser: 'typescript' }));
    });
  }

  // eslint-disable-next-line no-console
  messages.forEach(console.log);
};

const handlePreSource = (file: string, program: ts.Program, printer: ts.Printer): Relay | null => {
  const source = program.getSourceFile(file);
  if (!source || source.isDeclarationFile) return null;
  const sections = splitStatements(source);
  const typeEntries = parseTypeEntriesFromStatements(sections.MAIN);
  if (!typeEntries) {
    // eslint-disable-next-line no-console
    console.warn(`'${source.fileName}' has been skipped. Check usage of 'typeshot' in the file.`);
    return null;
  }

  const context = runSourceWithContext(source, program.getCompilerOptions(), {
    mode: 'pre',
    types: typeEntries,
    entries: [],
    dynamicEntryCount: 0,
  });

  const statements = context.entries.map(createTypeshotStatementFromEntry);
  const hasTypeshotImport =
    sections.OUTPUT_HEADER.some(isTypeshotImportDeclaration) ||
    sections.HEADER.some(isTypeshotImportDeclaration) ||
    sections.FOOTER.some(isTypeshotImportDeclaration) ||
    sections.OUTPUT_FOOTER.some(isTypeshotImportDeclaration);

  const header = context.header || '';
  const content = printer.printFile(
    ts.updateSourceFileNode(
      source,
      ts.createNodeArray([
        ...(hasTypeshotImport ? [] : [TypeshotImportDeclaration]),
        ...sections.OUTPUT_HEADER,
        ...sections.HEADER,
        COMMENT_NODES.MAIN,
        ...statements,
        ...sections.FOOTER,
        ...sections.OUTPUT_FOOTER,
      ]),
      false,
    ),
  );

  const output = context.config?.output;
  const { dir: sourceDir, name } = path.parse(file);
  const tempFilePath = path.join(sourceDir, `${name}.typeshot-tmp.ts`);
  const destination = output
    ? path.isAbsolute(output)
      ? output
      : path.resolve(sourceDir, output)
    : path.join(sourceDir, '__snapshot__', `${name}.snapshot`);
  const { dir: destinationDir } = path.parse(destination);

  return { header, content, tempFilePath, destination, sourceDir, destinationDir };
};

const handlePostSource = (relay: Relay, program: ts.Program, checker: ts.TypeChecker, printer: ts.Printer) => {
  const { header, destinationDir, sourceDir, tempFilePath } = relay;
  const source = program.getSourceFile(tempFilePath);
  if (!source || source.isDeclarationFile) return;

  const sections = splitStatements(source);
  const typeEntries = parseTypeEntriesFromStatements(sections.MAIN);
  if (!typeEntries) {
    // eslint-disable-next-line no-console
    console.warn(`'${source.fileName}' has been skipped. Check usage of 'typeshot' in the file.`);
    return;
  }

  const context = runSourceWithContext(source, program.getCompilerOptions(), {
    mode: 'post',
    types: typeEntries,
    entries: [],
    dynamicEntryCount: 0,
  });

  return [
    header,
    printer.printList(
      ts.ListFormat.None,
      ts.createNodeArray(sections.OUTPUT_HEADER.map((s) => updateImportPath(s, sourceDir, destinationDir))),
      source,
    ),
    context.entries.map((entry) => serializeEntry(entry, checker, printer)).join(''),
    printer.printList(
      ts.ListFormat.None,
      ts.createNodeArray(sections.OUTPUT_FOOTER.map((s) => updateImportPath(s, sourceDir, destinationDir))),
      source,
    ),
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

const createTSProgram = (
  basePath: string,
  project: string,
  sys: ts.System,
  formatHost: ts.FormatDiagnosticsHost,
  extraFiles?: string[],
) => {
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

  const program = ts.createProgram({
    rootNames: extraFiles ? [...extraFiles, ...tsconfig.fileNames] : tsconfig.fileNames,
    options: tsconfig.options,
    projectReferences: tsconfig.projectReferences,
  });

  return program;
};

export default runTypeshot;
