import ts from 'typescript';
import { runWithContext } from '../context';
import { TypeInstanceObject } from '../typeshot';
import { resolveTypeInstance } from './resolve-type-instance';
import { TypeDefinition, resolveTypeDefinition, resolveIntermediateDefinition } from './resolve-type-definition';
import { createIntermediateFiles } from './create-intermediate-files';
import { createTsProgram } from '../utils/ts-program';
import { resolveCustomContent } from './resolve-custom-content';

export interface TypeshotOptions {
  basePath?: string;
  project?: string;
}

export const runSingle = async (targetFileName: string, sys: ts.System, options: TypeshotOptions = {}) => {
  const getSourceFile = createSourceFileGetter(sys);
  const targetSourceFile = getSourceFile(targetFileName);
  if (!targetSourceFile) throw new Error(`File Not Found: target file ${targetFileName} is not found`);

  const context = await runWithContext(targetFileName, {
    definitionInfoMap: new Map(),
    template: [],
    header: null,
    footer: null,
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

  let acc = '';
  acc += resolveCustomContent(context.header, targetSourceFile);
  context.template.forEach((content) => {
    if (content instanceof TypeInstanceObject) {
      const type = definitions.get(content.definitionId)?.types.get(content.id);
      if (!type) throw new Error('');
      acc += type;
    } else {
      acc += content;
    }
  });
  acc += resolveCustomContent(context.footer, targetSourceFile);

  console.log(acc);

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
