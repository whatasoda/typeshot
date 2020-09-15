import ts from 'typescript';
import type { TypeToken } from '../typeshot';
import { ResolvedTypeDefinition } from './resolve-type-definition';

export const createIntermediateFiles = (collection: Map<ResolvedTypeDefinition, Map<TypeToken, string>>) => {
  type Transform = readonly [start: number, end: number, content: string];
  const intermediateTransforms = new Map<ts.SourceFile, Transform[]>();
  collection.forEach((tokens, { sourceFile, transformRange }) => {
    let acc: string = '';
    tokens.forEach((tokenContent, token) => {
      acc += `${token.id}: ${tokenContent};`;
    });
    const content = `() => {type _ = {${acc}}}`;

    if (!intermediateTransforms.has(sourceFile)) {
      intermediateTransforms.set(sourceFile, []);
    }
    const transforms = intermediateTransforms.get(sourceFile)!;
    const [start, end] = transformRange;
    transforms[start] = [start, end, content];
  });

  const intermediateFiles = new Map<string, string>();
  intermediateTransforms.forEach((transforms, sourceFile) => {
    const sourceText = sourceFile.getText();
    let acc = '';
    let cursor = 0;
    transforms.forEach(([start, end, content]) => {
      acc += sourceText.slice(cursor, start) + content;
      cursor = end;
    });
    acc += sourceText.slice(cursor);
    intermediateFiles.set(sourceFile.fileName, acc);
  });

  return intermediateFiles;
};
