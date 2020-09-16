import ts from 'typescript';
import path from 'path';
import prettier from 'prettier';
import { SourceTrace, TypeInstanceObject } from '../typeshot';
import { runWithContext } from '../context';
import { createTsProgram } from '../utils/ts-program';
import { ensureAbsolutePath } from '../utils/converters';
import { resolveTypeInstance } from './resolve-type-instance';
import { emitIntermediateFiles } from './emit-intermediate-file';
import { createIntermediateFiles } from './create-intermediate-files';
import { collectImportPathTransform } from './collect-import-path-transform';
import { resolveSourceTrace, serializeSourceTrace } from './resolve-source-trace';
import { TypeDefinition, resolveTypeDefinition, resolveIntermediateDefinition } from './resolve-type-definition';
import { formatSafely } from '../utils/format-safely';

export interface TypeshotOptions {
  sourceFileName: string;
  outputFileName: string;
  basePath?: string;
  project?: string;
  prettierOptions?: prettier.Options;
  emitIntermediateFiles?: boolean;
}

export const runSingle = async (sys: ts.System, options: TypeshotOptions) => {
  const { basePath = process.cwd(), project = 'tsconfig.json' } = options;
  const sourceFileName = ensureAbsolutePath(options.sourceFileName, basePath);
  const outputFileName = ensureAbsolutePath(options.outputFileName, basePath);

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

  let result = '';
  context.template.forEach((content) => {
    if (content instanceof TypeInstanceObject) {
      result += definitions.get(content.definitionId)?.types.get(content.id);
    } else if (content instanceof SourceTrace) {
      result += serializeSourceTrace(sourceText, content, transforms);
    } else {
      result += content;
    }
  });

  sys.writeFile(outputFileName, formatSafely(result, basePath, options.prettierOptions));
  // TODO: log complete message
  if (options.emitIntermediateFiles) {
    emitIntermediateFiles(
      sys,
      path.resolve(__dirname, '../.intermediate-files'),
      outputFileName,
      basePath,
      intermediateFiles,
    );
  }
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
