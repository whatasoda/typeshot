#!/usr/bin/env node
import arg from 'arg';
import path from 'path';
import { runSingleInSubprocess } from '../program/run-single-in-subprocess';
import { runMultiple, TypeshotCommonOptions } from '../program/run-multiple';

const CWD = process.cwd();
const DEFAULT_MAX_PARALLEL = 3;

interface CLIOptionsWide {
  project?: string;
  basePath?: string;
  inputFile?: string;
  inputFiles?: string[];
  outFile?: string;
  outDir?: string;
  rootDir?: string;
  emitIntermediateFiles?: boolean;
  prettierConfig?: string;
  systemModule?: string;
  maxParallel?: number;
}

type Base = Omit<CLIOptionsWide, 'inputFile' | 'outFile' | 'outDir' | 'inputFiles'>;
export type CLIOptions =
  | ({ inputFile: string; outFile: string } & Base)
  | ({ inputFile: string; outDir: string } & Base)
  | ({ inputFiles: string[]; outDir: string } & Base);

export const validateOptions = (options: CLIOptionsWide): CLIOptions => {
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
  return options as CLIOptions;
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
    '--basePath': basePath,
    '--emitIntermediateFiles': emitIntermediateFiles,
    '--prettierConfig': prettierConfig,
    '--systemModule': systemModule,
    '--maxParallel': maxParallel,
  } = argm;

  if (help) exitWithHelp();

  return validateOptions({
    inputFile,
    inputFiles,
    outFile,
    outDir,
    project,
    basePath,
    emitIntermediateFiles,
    prettierConfig,
    systemModule,
    maxParallel,
  });
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
  const { basePath, rootDir } = cliOptions;
  if ('outFile' in cliOptions) {
    return cliOptions.outFile;
  } else {
    const localName = path.relative(rootDir || basePath || CWD, inputFileName);
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
