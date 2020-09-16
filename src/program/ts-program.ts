import ts from 'typescript';

export const createTsProgram = (
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

  const program = ts.createProgram({
    host,
    options,
    projectReferences,
    rootNames: fileNames,
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
