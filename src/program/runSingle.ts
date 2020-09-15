import ts from 'typescript';
import { runWithContext } from '../context';
import { TypeToken, TypeTokenObject } from '../typeshot';
import { resolveTypeToken } from './resolve-type-token';
import { ResolvedTypeDefinition, resolveTypeDefinition } from './resolve-type-definition';
import { createIntermediateFiles } from './create-intermediate-files';

export const runSingle = async (fileName: string, sys: ts.System) => {
  const getSourceFile = createSourceFileGetter(sys);

  const context = await runWithContext(fileName, {
    definitions: new Map(),
    template: [],
  });

  const resolvedDefinitions = new Map<string, ResolvedTypeDefinition>();
  context.definitions.forEach((definition) => {
    resolvedDefinitions.set(definition.id, resolveTypeDefinition(definition, getSourceFile));
  });

  const [typeTokenCollection, addTypeToken] = createTypeTokenCollection(resolvedDefinitions);
  context.template.forEach((content) => {
    if (content instanceof TypeTokenObject) {
      addTypeToken(content);
    }
  });

  // WIP
  return createIntermediateFiles(typeTokenCollection);
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

const createTypeTokenCollection = (definitionMap: Map<string, ResolvedTypeDefinition>) => {
  const collection = new Map<ResolvedTypeDefinition, Map<TypeToken, string>>();
  const addTypeToken = (token: TypeToken) => {
    const definition = definitionMap.get(token.definitionId);
    if (!definition) {
      throw new Error(`Unknown Type Definition: type definition '${token.definitionId}' is not found`);
    }
    if (!collection.has(definition)) {
      collection.set(definition, new Map());
    }
    const map = collection.get(definition)!;
    const result = resolveTypeToken(token, definition);
    map.set(token, result);
  };
  return [collection, addTypeToken] as const;
};
