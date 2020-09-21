import ts from 'typescript';
import micromatch from 'micromatch';

export const createTsProgram = (
  files: string[] | null,
  basePath: string,
  project: string,
  sys: ts.System,
  customFileReader: (readFile: ts.System['readFile'], ...args: Parameters<ts.System['readFile']>) => string | undefined,
) => {
  const { options, projectReferences, fileNames } = readConfigFile(basePath, project, sys, {
    getCanonicalFileName: (path) => path,
    getCurrentDirectory: sys.getCurrentDirectory,
    getNewLine: () => sys.newLine,
  });

  const host = ts.createCompilerHost(options, true);
  const readFileDefault = sys.readFile;
  host.readFile = (...args) => customFileReader(readFileDefault, ...args);

  const { typeRoots } = options;
  if (files && typeRoots) {
    files = [
      ...files,
      ...micromatch(fileNames, [...typeRoots.map((typeRoot) => `${typeRoot}/(*|*/index(.d.ts|.ts))`)]),
    ];
  }

  const program = ts.createProgram({
    host,
    options,
    projectReferences,
    rootNames: files || fileNames,
  });
  const checker = program.getTypeChecker();
  const printer = ts.createPrinter();

  return { program, checker, printer };
};

const readConfigFile = (basePath: string, project: string, sys: ts.System, formatHost: ts.FormatDiagnosticsHost) => {
  const configFileContent = ts.readConfigFile(project, sys.readFile);
  if (configFileContent.error) {
    throw new Error(ts.formatDiagnostic(configFileContent.error, formatHost));
  }

  const tsconfig = ts.parseJsonConfigFileContent(configFileContent.config, sys, basePath);
  if (tsconfig.errors.length) {
    throw new Error(ts.formatDiagnostics(tsconfig.errors, formatHost));
  }

  return tsconfig;
};

export const createSourceFileGetter = (sys: ts.System) => {
  const cache = new Map<string, ts.SourceFile | null>();
  return (fileName: string) => {
    if (cache.has(fileName)) {
      return cache.get(fileName) || null;
    }
    const sourceText = sys.readFile(fileName, 'utf-8');
    if (!sourceText) {
      cache.set(fileName, null);
      return null;
    }
    const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.Unknown);
    cache.set(fileName, sourceFile);
    return sourceFile;
  };
};
