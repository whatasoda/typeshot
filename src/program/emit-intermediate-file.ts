import ts from 'typescript';
import path from 'path';
import { getDirectoryLessPath } from '../utils/converters';

export const emitIntermediateFiles = (
  sys: ts.System,
  destinationDir: string,
  outputFileName: string,
  basePath: string,
  imdFiles: Map<string, string>,
) => {
  const scopeName = getDirectoryLessPath(outputFileName, basePath);
  imdFiles.forEach((content, filename) => {
    const destination = path.join(destinationDir, scopeName, getDirectoryLessPath(filename, basePath));
    sys.writeFile(destination, content);
  });

  return path.join(destinationDir, scopeName);
};
