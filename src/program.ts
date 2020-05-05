import ts from 'typescript';

export const prepareProgram = (
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
