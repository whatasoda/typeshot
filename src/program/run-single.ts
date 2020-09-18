import ts from 'typescript';
import path from 'path';
import prettier from 'prettier';
import { SourceTrace, TypeInstanceObject } from '../typeshot';
import { runWithContext } from '../context';
import { formatSafely } from '../utils/format-safely';
import { createSourceFileGetter, createTsProgram } from '../utils/ts-program';
import { ensureAbsolutePath } from '../utils/converters';
import { createIntermediateTypeText } from './intermediate-type/create-type-text';
import { emitImdFiles } from './emit-intermediate-file';
import { createIntermediateFiles } from './create-intermediate-files';
import { collectImportPathTransform } from './collect-import-path-transform';
import { resolveSourceTrace, serializeSourceTrace } from './resolve-source-trace';
import { TypeDefinition, resolveTypeDefinition, resolveImdDefinition } from './resolve-type-definition';

export interface TypeshotOptions {
  inputFileName: string;
  outputFileName: string;
  basePath?: string;
  project?: string;
  prettierOptions?: prettier.Options | string;
  emitIntermediateFiles?: boolean;
}

let isCalled = false;
export const runSingle = async (sys: ts.System, options: TypeshotOptions) => {
  if (isCalled) {
    throw new Error('Use runSingleInSubprocess or runMultiple to evaluate multiple input files.');
  } else {
    isCalled = true;
  }
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
      const { definitionId, value } = content;
      const definition = definitions.get(definitionId);
      if (!definition) {
        throw new Error(`Unknown Type Definition: type definition '${definitionId}' is not found`);
      }
      definition.intermediateTypes.set(content, createIntermediateTypeText(value, definition));
    } else if (content instanceof SourceTrace) {
      resolveSourceTrace(inputFile, content);
    }
  });

  const imdFiles = createIntermediateFiles(definitions);
  const { program, checker, printer } = createTsProgram(basePath, project, sys, (readFile, path, encoding) => {
    return imdFiles.get(path) || readFile(path, encoding);
  });
  definitions.forEach((definition) => {
    resolveImdDefinition(definition, program, checker, printer);
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
      result += definitions.get(content.definitionId)!.resultTypeGenerators.get(content.id)!(content);
    } else if (content instanceof SourceTrace) {
      result += serializeSourceTrace(sourceText, content, transforms);
    } else {
      result += content;
    }
  });

  sys.writeFile(outputFileName, formatSafely(result, basePath, options.prettierOptions));
  if (options.emitIntermediateFiles) {
    const imdFileDir = emitImdFiles(
      sys,
      path.resolve(__dirname, '../.intermediate-files'),
      outputFileName,
      basePath,
      imdFiles,
    );
    console.log(
      `Finished '${inputFileName}', result emitted to '${outputFileName}', intermediate files stored in '${imdFileDir}'`,
    );
  } else {
    console.log(`Finished '${inputFileName}', result emitted to '${outputFileName}'`);
  }
};
