import ts from 'typescript';
import { runWithContext } from '../context';
import { TypeInstanceObject } from '../typeshot';
import { resolveTypeInstance } from './resolve-type-instance';
import { TypeDefinition, resolveTypeDefinition } from './resolve-type-definition';
import { createIntermediateFiles } from './create-intermediate-files';

export const runSingle = async (fileName: string, sys: ts.System) => {
  const getSourceFile = createSourceFileGetter(sys);

  const context = await runWithContext(fileName, {
    definitionInfoMap: new Map(),
    template: [],
  });

  const definitions = new Map<string, TypeDefinition>();
  context.definitionInfoMap.forEach((info) => {
    definitions.set(info.id, resolveTypeDefinition(info, getSourceFile));
  });

  context.template.forEach((content) => {
    if (content instanceof TypeInstanceObject) {
      resolveTypeInstance(content, definitions);
    }
  });

  // WIP
  return createIntermediateFiles(definitions);
};

const createSourceFileGetter = (sys: ts.System) => {
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
