import ts from 'typescript';
import path from 'path';
import { runWithContext } from '../context';
import { SourceTrace, TypeInstanceObject } from '../typeshot';
import { resolveTypeInstance } from './resolve-type-instance';
import { TypeDefinition, resolveTypeDefinition, resolveIntermediateDefinition } from './resolve-type-definition';
import { createIntermediateFiles } from './create-intermediate-files';
import { createTsProgram } from '../utils/ts-program';
import { resolveSourceTrace, serializeSourceTrace } from './resolve-source-trace';
import { collectImportPathTransform } from './collect-import-path-transform';

export interface TypeshotOptions {
  basePath?: string;
  project?: string;
}

export const runSingle = async (
  sourceFileName: string,
  outputFileName: string,
  sys: ts.System,
  options: TypeshotOptions = {},
) => {
  const { basePath = process.cwd(), project = 'tsconfig.json' } = options;
  sourceFileName = path.isAbsolute(sourceFileName) ? sourceFileName : path.resolve(basePath, sourceFileName);
  outputFileName = path.isAbsolute(outputFileName) ? outputFileName : path.resolve(basePath, outputFileName);

  const getSourceFile = createSourceFileGetter(sys);
  const targetFile = getSourceFile(sourceFileName);
  if (!targetFile) throw new Error(`File Not Found: target file ${sourceFileName} is not found`);

  const context = await runWithContext(sourceFileName, {
    definitionInfoMap: new Map(),
    template: [],
    pendingTrace: null,
  });

  const definitions = new Map<string, TypeDefinition>();
  context.definitionInfoMap.forEach((info) => {
    definitions.set(info.id, resolveTypeDefinition(info, getSourceFile));
  });

  context.template.forEach((content) => {
    if (content instanceof TypeInstanceObject) {
      resolveTypeInstance(content, definitions);
    } else if (content instanceof SourceTrace) {
      resolveSourceTrace(targetFile, content);
    }
  });

  const intermediateFiles = createIntermediateFiles(definitions);

  const { program, checker, printer } = createTsProgram(basePath, project, sys, (readFile, path, encoding) => {
    return intermediateFiles.get(path) || readFile(path, encoding);
  });
  definitions.forEach((definition) => {
    resolveIntermediateDefinition(definition, program, checker, printer);
  });

  const sourceText = targetFile.getFullText();
  const sourceDir = path.parse(sourceFileName).dir;
  const outputDir = path.parse(outputFileName).dir;
  const transforms = collectImportPathTransform([], targetFile, sourceDir, outputDir);

  let acc = '';
  context.template.forEach((content) => {
    if (content instanceof TypeInstanceObject) {
      acc += definitions.get(content.definitionId)?.types.get(content.id);
    } else if (content instanceof SourceTrace) {
      acc += serializeSourceTrace(sourceText, content, transforms);
    } else {
      acc += content;
    }
  });

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
