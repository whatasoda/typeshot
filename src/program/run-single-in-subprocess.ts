import type ts from 'typescript';
import { exec } from 'child_process';
import { runSingle, TypeshotOptions } from './run-single';

const runtime = /\.tsx?$/.test(__filename) ? 'ts-node-transpile-only' : 'node';

export const runSingleInSubprocess = (options: TypeshotOptions, systemModulePath: string = 'typescript') => {
  return new Promise<void>((resolve, reject) => {
    const cp = exec(`${runtime} ${__filename} '${JSON.stringify(options)}' ${systemModulePath}`);
    cp.stdout?.pipe(process.stdout);
    cp.stderr?.pipe(process.stderr);
    cp.on('close', (code) => (code === 0 ? resolve() : reject()));
  });
};

if (require.main === module) {
  const getSystem = (systemModulePath: string) => {
    const systemModule = require(systemModulePath);
    if (!systemModule || !('sys' in systemModule)) {
      throw new Error('');
    }
    return systemModule.sys as ts.System;
  };

  const main = async () => {
    const [, , optionsJson, systemSourcePath] = process.argv;
    const options = JSON.parse(optionsJson) as TypeshotOptions;
    const sys = getSystem(systemSourcePath);
    try {
      await runSingle(sys, options);
    } catch (e) {
      console.log(e);
      process.exit(1);
    }
  };

  main();
}
