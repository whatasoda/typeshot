import ts from 'typescript';
import vm from 'vm';
import type { TypeshotEntry, TypeInformation } from './program/decls';
import type { Config } from './typeshot';

export interface TypeshotContext {
  readonly mode: 'pre' | 'post';
  readonly entries: TypeshotEntry[];
  readonly types: Record<string, TypeInformation>;
  dynamicEntryCount: number;
  header?: string;
  config?: Config;
}

const CURRENT_TYPESHOT_CONTEXT = { current: null as null | TypeshotContext };

export const getCurrentContext = () => CURRENT_TYPESHOT_CONTEXT.current;

const runSourceWithContext = (
  source: ts.SourceFile,
  options: ts.CompilerOptions,
  context: TypeshotContext,
): TypeshotContext => {
  const prev = CURRENT_TYPESHOT_CONTEXT.current;
  try {
    const executableCode = ts.transpile(source.getFullText(), options);
    CURRENT_TYPESHOT_CONTEXT.current = context;
    vm.runInNewContext(executableCode, { exports: {}, require });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
  } finally {
    CURRENT_TYPESHOT_CONTEXT.current = prev;
  }
  return context;
};

export default runSourceWithContext;
