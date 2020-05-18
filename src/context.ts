import ts from 'typescript';
import vm from 'vm';
import type { TypeshotEntry, TypeInformation } from './program/decls';
import type { Config } from './typeshot';
import { Module } from 'module';

export interface TypeshotContext {
  readonly entries: TypeshotEntry[];
  readonly types: Map<string, TypeInformation>;
  header?: string;
  config?: Config;
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
