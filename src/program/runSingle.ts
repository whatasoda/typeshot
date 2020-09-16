import ts from 'typescript';
import { runWithContext } from '../context';
import { TypeInstanceObject } from '../typeshot';
import { resolveTypeInstance } from './resolve-type-instance';
import { TypeDefinition, resolveTypeDefinition, resolveIntermediateDefinition } from './resolve-type-definition';
import { createIntermediateFiles } from './create-intermediate-files';
import { createTsProgram } from './ts-program';

export interface TypeshotOptions {
  basePath?: string;
  project?: string;
}

export const runSingle = async (fileName: string, sys: ts.System, options: TypeshotOptions = {}) => {
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

  const intermediateFiles = createIntermediateFiles(definitions);
  const { basePath = process.cwd(), project = 'tsconfig.json' } = options;

  const { program, checker, printer } = createTsProgram(basePath, project, sys, (readFile, path, encoding) => {
    return intermediateFiles.get(path) || readFile(path, encoding);
  });
  definitions.forEach((definition) => {
    resolveIntermediateDefinition(definition, program, checker, printer);
  });

  const typeshotContent = context.template.map((content) => {
    if (content instanceof TypeInstanceObject) {
      const type = definitions.get(content.definitionId)?.types.get(content.id);
      if (!type) throw new Error('');
      return type;
    }
    return content;
  });
  // WIP
  console.log(typeshotContent);

  return intermediateFiles;
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
