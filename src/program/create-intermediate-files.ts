import ts from 'typescript';
import { TypeDefinition } from './resolve-type-definition';

export const createIntermediateFiles = (definitions: Map<string, TypeDefinition>) => {
  type Transform = {
    start: number;
    end: number;
    content: string;
  };
  const intermediateTransforms = new Map<ts.SourceFile, Transform[]>();
  definitions.forEach((definition) => {
    const { sourceFile, start, end } = definition;
    let acc: string = '';
    definition.intermediateTypes.forEach((intermediateType, token) => {
      acc += `${token.id}: ${intermediateType};`;
    });
    const content = `() => {type _ = {${acc}};}`;

    if (!intermediateTransforms.has(sourceFile)) {
      intermediateTransforms.set(sourceFile, []);
    }
    const transforms = intermediateTransforms.get(sourceFile)!;
    transforms[start] = { start, end, content };
  });

  const intermediateFiles = new Map<string, string>();
  intermediateTransforms.forEach((transforms, sourceFile) => {
    const sourceText = sourceFile.getText();
    let acc = '';
    let cursor = 0;
    transforms.forEach(({ start, end, content }) => {
      acc += sourceText.slice(cursor, start);
      // TODO:
      acc += content;
      cursor = end;
    });
    acc += sourceText.slice(cursor);
    intermediateFiles.set(sourceFile.fileName, acc);
  });

  return intermediateFiles;
};
