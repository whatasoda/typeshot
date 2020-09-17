import { REGISTER_INSTANCE, register, RegisterOptions } from 'ts-node';
import type { PrinterTemplate, TraceBreak, TypeDefinitionInfo } from './typeshot';

export interface TypeshotContext {
  readonly definitionInfoMap: Map<string, TypeDefinitionInfo>;
  readonly template: PrinterTemplate;
  pendingTrace: TraceBreak | null;
  promise?: Promise<void>;
}

const CURRENT_TYPESHOT_CONTEXT = { current: null as null | TypeshotContext };

export const getContext = () => {
  const context = CURRENT_TYPESHOT_CONTEXT.current;
  if (context) return context;
  throw new Error('Context Missed: Make sure to run via typeshot program');
};

export const runWithContext = async (
  filename: string,
  context: TypeshotContext,
  registerOptions?: RegisterOptions,
): Promise<TypeshotContext> => {
  if (CURRENT_TYPESHOT_CONTEXT.current) {
    throw new Error('Invalid Operation: typeshot cannot evaluate multiple files at the same time in the same context');
  }
  try {
    if (!(REGISTER_INSTANCE in process)) register({ ...registerOptions, transpileOnly: true });
    CURRENT_TYPESHOT_CONTEXT.current = context;
    require(filename);
    await context.promise;
  } catch (e) {
    console.log(e);
  }
  return context;
};
