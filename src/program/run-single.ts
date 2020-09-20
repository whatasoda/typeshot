import ts from 'typescript';
import path from 'path';
import prettier from 'prettier';
import { runWithContext } from './context';
import { formatSafely } from '../utils/format-safely';
import { createSourceFileGetter, createTsProgram } from '../utils/ts-program';
import { createIntermediateTypeText } from './intermediate-type/create-type-text';
import { emitIntermediateFiles } from './emit-intermediate-file';
import { createIntermediateFiles } from './create-intermediate-files';
import { collectImportPathTransform } from './collect-import-path-transform';
import { resolveSourceTrace, serializeSourceTrace } from './resolve-source-trace';
import { TypeDefinition } from './type-definition';
import { isSourceTrace } from '../typeshot/source-trace';
import { isTypeInstance } from '../typeshot/type-instance';

export interface TypeshotOptions {
  /** should be absolute path */
  inputFileName: string;
  /** should be absolute path */
  outputFileName: string;
  /** should be absolute path */
  basePath: string;
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
  const { basePath, inputFileName, outputFileName, project = 'tsconfig.json' } = options;
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
    definitions.set(info.id, new TypeDefinition(info, getSourceFile));
  });

  context.template.forEach((content) => {
    if (isTypeInstance(content)) {
      const { definitionId, value } = content;
      const definition = definitions.get(definitionId);
      if (!definition) {
        throw new Error(`Unknown Type Definition: type definition '${definitionId}' is not found`);
      }
      definition.intermediateTypes.set(content, createIntermediateTypeText(value, definition));
    } else if (isSourceTrace(content)) {
      resolveSourceTrace(inputFile, content);
    }
  });

  const intermediateFiles = createIntermediateFiles(definitions);
  const { program, checker, printer } = createTsProgram(basePath, project, sys, (readFile, path, encoding) => {
    return intermediateFiles.get(path) || readFile(path, encoding);
  });
  definitions.forEach((definition) => definition.evaluateIntermediateFile(program, checker, printer));

  const sourceText = inputFile.getFullText();
  const transforms = collectImportPathTransform(
    [],
    inputFile,
    path.dirname(inputFileName),
    path.dirname(outputFileName),
  );

  let result = '';
  context.template.forEach((content) => {
    if (isTypeInstance(content)) {
      result += definitions.get(content.definitionId)!.resultTypeGenerators.get(content.id)!(content);
    } else if (isSourceTrace(content)) {
      result += serializeSourceTrace(sourceText, content, transforms);
    } else {
      result += content;
    }
  });

  sys.writeFile(outputFileName, formatSafely(result, basePath, options.prettierOptions));
  if (options.emitIntermediateFiles) {
    const rootDir = path.resolve(__dirname, '../.intermediate-files');
    const intermediateFileDir = emitIntermediateFiles(sys, rootDir, outputFileName, basePath, intermediateFiles);
    console.log(
      `Finished '${inputFileName}', result emitted to '${outputFileName}', intermediate files stored in '${intermediateFileDir}'`,
    );
  } else {
    console.log(`Finished '${inputFileName}', result emitted to '${outputFileName}'`);
  }
};
