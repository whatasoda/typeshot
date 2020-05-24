import ts from 'typescript';
import vm from 'vm';
import { Module } from 'module';
import type { Config, TypeToken } from './typeshot';

export interface TypeshotContext {
  readonly getType: (id: string) => TypeInformation | undefined;
  readonly requests: TypeRequest[];
  readonly template: (string | TypeToken)[];
  header?: string;
  config?: Config;
}

export interface TypeInformation {
  rootId: string;
  type: ts.TypeNode;
}

export interface TypeRequest {
  id: string;
  type: ts.TypeNode;
  property?: string | number;
}

const CURRENT_TYPESHOT_CONTEXT = { current: null as null | TypeshotContext };

export const getCurrentContext = () => CURRENT_TYPESHOT_CONTEXT.current;

const runSourceWithContext = (
  source: ts.SourceFile,
  sourceText: string,
  options: ts.CompilerOptions,
  context: TypeshotContext,
): TypeshotContext => {
  const prev = CURRENT_TYPESHOT_CONTEXT.current;
  try {
    const executableCode = ts.transpile(sourceText, options);
    const { fileName } = source;

    const MODULE = new Module(fileName, module);
    const pure = MODULE.require;
    MODULE.filename = fileName;
    MODULE.require = ((id) => (id === 'typeshot' ? require('./typeshot') : pure.call(MODULE, id))) as typeof require;
    Object.assign(MODULE.require, pure);

    CURRENT_TYPESHOT_CONTEXT.current = context;
    vm.runInNewContext(executableCode, MODULE);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
  } finally {
    CURRENT_TYPESHOT_CONTEXT.current = prev;
  }
  return context;
};
runSourceWithContext.hoge = () => require('./typeshot');

export default runSourceWithContext;
