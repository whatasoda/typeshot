import ts from 'typescript';
import { TypeDefinition } from './resolve-type-definition';

export const createIntermediateFiles = (allDefinitions: Map<string, TypeDefinition>) => {
  const intermediateTransforms = new Map<ts.SourceFile, TypeDefinition[]>();
  allDefinitions.forEach((definition) => {
    const { sourceFile, start } = definition;
    if (!intermediateTransforms.has(sourceFile)) {
      intermediateTransforms.set(sourceFile, []);
    }
    const transforms = intermediateTransforms.get(sourceFile)!;
    definition.prepareIntermediateContent();
    transforms[start] = definition;
  });

  const intermediateFiles = new Map<ts.SourceFile, string>();
  intermediateTransforms.forEach((definitions, sourceFile) => {
    const sourceText = sourceFile.getText();
    let acc = '';
    let cursor = 0;
    definitions.forEach((definition) => {
      acc += sourceText.slice(cursor, definition.start);
      definition.setIntermediatePosition(acc.length);
      acc += definition.intermediateContent;
      cursor = definition.end;
    });
    acc += sourceText.slice(cursor);
    intermediateFiles.set(sourceFile, acc);
  });

  return intermediateFiles;
};
