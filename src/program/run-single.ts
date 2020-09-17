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
  inputFileName: string;
  outputFileName: string;
  basePath?: string;
  project?: string;
  prettierOptions?: prettier.Options | string;
  emitIntermediateFiles?: boolean;
}

export const runSingle = async (sys: ts.System, options: TypeshotOptions) => {
  const { basePath = process.cwd(), project = 'tsconfig.json' } = options;
  const inputFileName = ensureAbsolutePath(options.inputFileName, basePath);
  const outputFileName = ensureAbsolutePath(options.outputFileName, basePath);
  console.log(`Processing '${inputFileName}'...`);

  const getSourceFile = createSourceFileGetter(sys);
  const inputFile = getSourceFile(inputFileName);
  if (!inputFile) throw new Error(`File Not Found: input file ${inputFileName} is not found`);

  const context = await runWithContext(inputFileName, {
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
      resolveSourceTrace(inputFile, content);
    }
  });

  const intermediateFiles = createIntermediateFiles(definitions);
  const { program, checker, printer } = createTsProgram(basePath, project, sys, (readFile, path, encoding) => {
    return intermediateFiles.get(path) || readFile(path, encoding);
  });
  definitions.forEach((definition) => {
    resolveIntermediateDefinition(definition, program, checker, printer);
  });

  const sourceText = inputFile.getFullText();
  const transforms = collectImportPathTransform(
    [],
    inputFile,
    path.dirname(inputFileName),
    path.dirname(outputFileName),
  );

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
  if (options.emitIntermediateFiles) {
    const intermediateFileDir = emitIntermediateFiles(
      sys,
      path.resolve(__dirname, '../.intermediate-files'),
      outputFileName,
      basePath,
      intermediateFiles,
    );
    console.log(
      `Finished '${inputFileName}', result emitted to '${outputFileName}', intermediate files stored in '${intermediateFileDir}'`,
    );
  } else {
    console.log(`Finished '${inputFileName}', result emitted to '${outputFileName}'`);
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
