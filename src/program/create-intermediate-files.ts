import ts from 'typescript';
import { TypeDefinition } from './resolve-type-definition';

export const createIntermediateFiles = (definitions: Map<string, TypeDefinition>) => {
  const transforms = new Map<ts.SourceFile, TypeDefinition[]>();
  definitions.forEach(({ definition, start, sourceFile }) => {
    if (!transforms.has(sourceFile)) {
      transforms.set(sourceFile, []);
    }
    transforms.get(sourceFile)![start] = definition;
  });

  const mediationFiles = new Map<string, string>();
  transforms.forEach((definitions, sourceFile) => {
    const sourceText = sourceFile.getText();
    let acc = '';
    let cursor = 0;
    definitions.forEach((definition) => {
      acc += sourceText.slice(cursor, definition.start);
      acc += definition.createMediationTypeText(acc.length);
      cursor = definition.end;
    });
    acc += sourceText.slice(cursor);
    mediationFiles.set(sourceFile.fileName, acc);
  });

  return mediationFiles;
};
