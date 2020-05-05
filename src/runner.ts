import ts from 'typescript';
import vm from 'vm';
import prettier from 'prettier';
import path from 'path';
import { prepareProgram } from './program';
import { createPreTypeshot, createPostTypeshot } from './factories';
import { parseTypeEntriesFromStatements, splitStatements, COMMENT_NODES } from './parsers';
import { injectTypeParameters, applyNamesToTypeNode } from './injector';
import { createTypeshotStatementFromEntry, updateImportPath } from './ast-utils';
import { serializeEntry } from './serialize';
import type { Config, ValueEntry, DefaultEntry, Typeshot } from '.';

interface Relay {
  header: string;
  content: string;
  tempFilePath: string;
  snapshotPath: string;
  relativePath: string;
}

const runTypeshot = (typeshotConfig: Config, sys: ts.System = ts.sys) => {
  const { basePath = process.cwd(), project = `${basePath}/tsconfig.json` } = typeshotConfig;
  const prettierOptions = typeshotConfig.prettierOptions || getPrettierOptions(basePath, sys);

  const formatHost: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (path) => path,
    getCurrentDirectory: sys.getCurrentDirectory,
    getNewLine: () => sys.newLine,
  };

  const printer = ts.createPrinter();
  const program = prepareProgram(basePath, project, sys, formatHost);
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
    const program = prepareProgram(basePath, project, sys, formatHost, extraFiles);
    const checker = program.getTypeChecker();

    relays.forEach((relay) => {
      const { snapshotPath } = relay;
      const content = handlePostSource(relay, program, checker, printer);
      if (!content) return;
      sys.writeFile(snapshotPath, prettier.format(content, { ...prettierOptions, parser: 'typescript' }));
    });
  }

  // eslint-disable-next-line no-console
  messages.forEach(console.log);
};

const handlePreSource = (file: string, program: ts.Program, printer: ts.Printer) => {
  const source = program.getSourceFile(file);
  if (!source || source.isDeclarationFile) return;
  const sections = splitStatements(source);
  const typeEntries = parseTypeEntriesFromStatements(sections.MAIN);
  if (!typeEntries) {
    // eslint-disable-next-line no-console
    console.warn(`'${source.fileName}' has been skipped. Check usage of 'typeshot' in the file.`);
    return;
  }

  const entries: ValueEntry[] = [];
  const [typeshot, container] = createPreTypeshot(typeEntries, entries);
  transpileAndRun(typeshot, source, program.getCompilerOptions());

  const statements = entries.reduce<ts.Statement[]>((acc, entry) => {
    switch (entry.mode) {
      case 'default': {
        acc.push(createTypeshotStatementFromEntry(entry));
        return acc;
      }
      case 'dynamic': {
        // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
        const { params: _, names, ...common } = entry;
        const injected = injectTypeParameters(entry);
        const namedTypes = applyNamesToTypeNode(names, injected);
        namedTypes.forEach(([name, type]) => {
          acc.push(createTypeshotStatementFromEntry({ ...common, mode: 'default', name, type }));
        });
        return acc;
      }
      default:
        return acc;
    }
  }, []);

  const header = container.header || '';
  const content = printer.printFile(
    ts.updateSourceFileNode(
      source,
      ts.createNodeArray([
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

  const output = container.config?.output;
  const { dir, name } = path.parse(file);
  const tempFilePath = path.join(dir, `${name}.typeshot-tmp.ts`);
  const snapshotPath = output
    ? path.isAbsolute(output)
      ? output
      : path.resolve(dir, output)
    : path.join(dir, '__snapshot__', `${name}.snapshot`);
  const relativePath = path.relative(snapshotPath, dir);

  return { header, content, tempFilePath, snapshotPath, relativePath };
};

const handlePostSource = (relay: Relay, program: ts.Program, checker: ts.TypeChecker, printer: ts.Printer) => {
  const { header, relativePath, tempFilePath } = relay;
  const source = program.getSourceFile(tempFilePath);
  if (!source || source.isDeclarationFile) return;

  const sections = splitStatements(source);
  const typeEntries = parseTypeEntriesFromStatements(sections.MAIN);
  if (!typeEntries) {
    // eslint-disable-next-line no-console
    console.warn(`'${source.fileName}' has been skipped. Check usage of 'typeshot' in the file.`);
    return;
  }

  const entries: DefaultEntry[] = [];
  const typeshot = createPostTypeshot(typeEntries, entries);
  transpileAndRun(typeshot, source, program.getCompilerOptions());

  return [
    header,
    printer.printList(
      ts.ListFormat.None,
      ts.createNodeArray(sections.OUTPUT_HEADER.map((s) => updateImportPath(s, relativePath))),
      source,
    ),
    entries.map((entry) => serializeEntry(entry, checker, printer)).join(''),
    printer.printList(
      ts.ListFormat.None,
      ts.createNodeArray(sections.OUTPUT_FOOTER.map((s) => updateImportPath(s, relativePath))),
      source,
    ),
    '\nexport {};\n',
  ].join('');
};

const transpileAndRun = (typeshot: Typeshot, source: ts.SourceFile, options: ts.CompilerOptions) => {
  try {
    const JS = ts.transpile(source.getFullText(), options);
    vm.runInNewContext(JS, { typeshot });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
    return;
  }
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

runTypeshot({ test: /\.typeshot\.ts$/ });
