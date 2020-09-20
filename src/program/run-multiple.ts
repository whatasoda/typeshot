import { evaluatePrallelly } from '../utils/evaluate-parallelly';
import { TypeshotOptions } from './run-single';
import { runSingleInSubprocess } from './run-single-in-subprocess';

export type TypeshotCommonOptions = Omit<TypeshotOptions, 'inputFileName' | 'outputFileName'>;

export const runMultiple = async (
  entries: (readonly [input: string, output: string])[],
  common: TypeshotCommonOptions,
  maxParallel: number,
  systemModulePath: string = 'typescript',
): Promise<void> => {
  console.log('Processing files parallelly...');
  let succeeded = 0;
  let failed = 0;
  const promise = evaluatePrallelly(maxParallel, entries, ([inputFileName, outputFileName]) => {
    return runSingleInSubprocess({ ...common, inputFileName, outputFileName }, systemModulePath);
  });
  promise.thenEach(() => succeeded++);
  promise.catchEach(() => failed++);
  await promise;

  console.log(`Succeeded: ${succeeded}, Failed: ${failed}`);
  if (failed) return Promise.reject();
};
