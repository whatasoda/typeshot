#!/usr/bin/env node
import arg from 'arg';
import path from 'path';
import { runSingleInSubprocess } from '../program/run-single-in-subprocess';
import { runMultiple, TypeshotCommonOptions } from '../program/run-multiple';
import { ensureAbsolutePath } from '../utils/converters';

const CWD = process.cwd();
const DEFAULT_MAX_PARALLEL = 3;

export type CLIOptions = ReturnType<typeof normalizeOptions>;

interface CLIOptionsWide {
  inputFile?: string;
  inputFiles?: string[];
  outFile?: string;
  outDir?: string;
  basePath?: string;
  project?: string;
  rootDir?: string;
  emitIntermediateFiles?: boolean;
  prettierConfig?: string;
  systemModule?: string;
  maxParallel?: number;
}

type Base = Omit<CLIOptionsWide, 'inputFile' | 'outFile' | 'outDir' | 'inputFiles'>;
type CLIOptionsValidated =
  | ({ inputFile: string; outFile: string } & Base)
  | ({ inputFile: string; outDir: string } & Base)
  | ({ inputFiles: string[]; outDir: string } & Base);

export const validateOptions = (options: CLIOptionsWide): CLIOptionsValidated => {
  if (!options.inputFile && !options.inputFiles?.length) {
    exitWithHelp('Make sure to specify --inputFile or input file list.');
  }
  if (options.inputFile && options.inputFiles?.length) {
    exitWithHelp('Unable to specify multiple files if --inputFile is specified.');
  }
  if (options.outFile && options.inputFiles?.length) {
    exitWithHelp('Unable to specify multiple files if --outFile is specified.');
  }
  if (options.outFile && options.outDir) {
    exitWithHelp('Unable to specify outDir if --outFile is specified.');
  }
  if (!options.outFile && !options.outDir) {
    exitWithHelp(`Make sure to specify ${options.inputFile ? '--outFile or ' : ''}--outDir.`);
  }

  if (options.inputFile) {
    delete options.inputFiles;
    options.outFile ? delete options.outDir : delete options.outFile;
  } else if (options.inputFiles) {
    delete options.inputFile;
    delete options.outFile;
  }
  return options as CLIOptionsValidated;
};

export const normalizeOptions = (options: CLIOptionsValidated) => {
  const basePath = options.basePath ? ensureAbsolutePath(options.basePath, CWD) : CWD;
  const rootDir = options.rootDir ? ensureAbsolutePath(options.rootDir, basePath) : basePath;

  if ('inputFile' in options) {
    options.inputFile = ensureAbsolutePath(options.inputFile, basePath);
    if ('outFile' in options) {
      options.outFile = ensureAbsolutePath(options.outFile, basePath);
    } else {
      options.outDir = ensureAbsolutePath(options.outDir, basePath);
    }
  } else {
    options.inputFiles = options.inputFiles.map((inputFile) => ensureAbsolutePath(inputFile, basePath));
    options.outDir = ensureAbsolutePath(options.outDir, basePath);
  }

  return { ...options, basePath, rootDir };
};

export const parseCLIOptions = (argv: string[]) => {
  if (!argv.length) exitWithHelp();

  const argm = arg(
    {
      '--help': Boolean,
      '--project': String,
      '--inputFile': String,
      '--outFile': String,
      '--outDir': String,
      '--rootDir': String,
      '--basePath': String,
      '--emitIntermediateFiles': Boolean,
      '--prettierConfig': String,
      '--systemModule': String,
      '--maxParallel': Number,
      // Aliases
      '-h': '--help',
      '-p': '--project',
      '-i': '--inputFile',
      '-o': '--outFile',
      '-O': '--outDir',
      '-b': '--basePath',
      '-E': '--emitIntermediateFiles',
    },
    { argv },
  );

  const {
    _: inputFiles,
    '--help': help,
    '--project': project,
    '--inputFile': inputFile,
    '--outFile': outFile,
    '--outDir': outDir,
    '--rootDir': rootDir,
    '--basePath': basePath,
    '--emitIntermediateFiles': emitIntermediateFiles,
    '--prettierConfig': prettierConfig,
    '--systemModule': systemModule,
    '--maxParallel': maxParallel,
  } = argm;

  if (help) exitWithHelp();

  return normalizeOptions(
    validateOptions({
      inputFile,
      inputFiles,
      outFile,
      outDir,
      project,
      basePath,
      rootDir,
      emitIntermediateFiles,
      prettierConfig,
      systemModule,
      maxParallel,
    }),
  );
};

const exitWithHelp = (error?: string) => {
  if (error) console.log(error);
  console.log(`
typeshot

Help:
`);
  process.exit(error ? 1 : 0);
};

export const resolveOutputFileName = (cliOptions: CLIOptions, inputFileName: string) => {
  if ('outFile' in cliOptions) {
    return cliOptions.outFile;
  } else {
    const localName = path.relative(cliOptions.rootDir, inputFileName);
    if (/^\.\.\//.test(localName)) {
      throw new Error(`Invalid rootDir: Make sure to place input files under rootDir.`);
    }
    return path.join(cliOptions.outDir, localName);
  }
};

const main = async () => {
  const cliOptions = parseCLIOptions(process.argv.slice(2));

  const { systemModule, maxParallel = DEFAULT_MAX_PARALLEL } = cliOptions;
  const common: TypeshotCommonOptions = {
    basePath: cliOptions.basePath,
    project: cliOptions.project,
    prettierOptions: cliOptions.prettierConfig,
    emitIntermediateFiles: cliOptions.emitIntermediateFiles,
  };

  try {
    if ('inputFile' in cliOptions) {
      const { inputFile: inputFileName } = cliOptions;
      const outputFileName = resolveOutputFileName(cliOptions, inputFileName);
      await runSingleInSubprocess({ ...common, inputFileName, outputFileName }, systemModule);
    } else {
      const entries = cliOptions.inputFiles.map((input) => [input, resolveOutputFileName(cliOptions, input)] as const);
      await runMultiple(entries, common, maxParallel, systemModule);
    }
  } catch {
    process.exit(1);
  }
};

if (require.main === module) main();
