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
  const queue = entries.values();
  const result = await evaluatePrallelly(maxParallel, async (onLastItem) => {
    const item = queue.next();
    if (item.done) {
      onLastItem();
    } else {
      const [inputFileName, outputFileName] = item.value;
      await runSingleInSubprocess({ ...common, inputFileName, outputFileName }, systemModulePath);
    }
    return true;
  });

  if (result.errors) {
    const successCount = result.payload.reduce<number>((acc, curr) => (curr ? acc + 1 : acc), -1);
    console.log(`Success: ${successCount}, Failed: ${entries.length - successCount}`);
    return Promise.reject();
  } else {
    console.log(`Succeeded: ${entries.length}, Failed: 0`);
    return;
  }
};
