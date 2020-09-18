import type ts from 'typescript';
import { fork, SendHandle, Serializable } from 'child_process';
import { runSingle, TypeshotOptions } from './run-single';
import { ensureAbsolutePath } from '../utils/converters';

const execArgv = /\.tsx?$/.test(__filename) ? ['-r', 'ts-node/register/transpile-only'] : [];

export const runSingleInSubprocess = (
  options: TypeshotOptions,
  systemModulePath: string = 'typescript',
  onMessage?: (message: Serializable, sendHandle: SendHandle) => void,
) => {
  return new Promise<void>((resolve, reject) => {
    const cp = fork(__filename, { execArgv });
    cp.send([options, ensureAbsolutePath(systemModulePath, options.basePath || process.cwd())]);
    cp.stdout?.pipe(process.stdout);
    cp.stderr?.pipe(process.stderr);
    cp.on('close', (code) => (code === 0 ? resolve() : reject()));
    if (onMessage) {
      cp.on('message', onMessage);
    }
  });
};

if (require.main === module) {
  if (!process.connected) {
    console.log('Make sure to run this module via runSingleInSubprocess');
    process.exit(1);
  }

  const args = new Promise<Parameters<typeof runSingle>>((resolve) => {
    process.once('message', ([options, systemModulePath]) => {
      const { sys } = require(systemModulePath) as Pick<typeof ts, 'sys'>;
      return resolve([sys, options]);
    });
  });

  const main = async () => {
    try {
      await runSingle(...(await args));
    } catch (e) {
      console.log(e);
      process.exit(1);
    }
  };

  main();
}
