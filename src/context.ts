import ts from 'typescript';
import path from 'path';
import { Module } from 'module';
import type { Config, TypeToken } from './typeshot';

export interface TypeshotContext {
  readonly getType: (id: string) => TypeInformation | undefined;
  readonly requests: Map<string, TypeRequest>;
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

const parent = module;
const runSourceWithContext = (
  source: ts.SourceFile,
  sourceText: string,
  options: ts.CompilerOptions,
  context: TypeshotContext,
): TypeshotContext => {
  const prev = CURRENT_TYPESHOT_CONTEXT.current;
  try {
    const { fileName: filename } = source;
    const script = ts.transpile(sourceText, options);
    CURRENT_TYPESHOT_CONTEXT.current = context;

    // https://github.com/nodejs/node/blob/6add5b31fcc4ae45a8603f886477c544a99e0188/lib/internal/bootstrap_node.js#L415
    const module = new Module(filename, parent);
    module.filename = filename;
    module.paths = (Module as any)._nodeModulePaths(path.dirname(filename));
    (module as any)._compile(script, filename);
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
