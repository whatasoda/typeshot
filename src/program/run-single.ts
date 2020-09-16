import ts from 'typescript';
import prettier from 'prettier';
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
  sourceFileName: string;
  outputFileName: string;
  basePath?: string;
  project?: string;
  prettierOptions?: prettier.Options;
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

  sys.writeFile(outputFileName, safeFormat(result, basePath, options.prettierOptions));
  // TODO: log complete message
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

const ensureAbsolutePath = (raw: string, basePath: string) => {
  return path.isAbsolute(raw) ? raw : path.resolve(basePath, raw);
};

const defaultPrettierOptions: prettier.Options = {
  parser: 'typescript',
};
const safeFormat = (raw: string, basePath: string, options: prettier.Options | undefined) => {
  try {
    options = options || prettier.resolveConfig.sync(basePath) || defaultPrettierOptions;
    return prettier.format(raw, options);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
    return raw;
  }
};
