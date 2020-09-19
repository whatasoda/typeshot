import path from 'path';
import { REGISTER_INSTANCE, register, RegisterOptions } from 'ts-node';
import type { TypeDefinitionInfo } from './type-definition';
import type { PrinterTemplate } from '../typeshot/printer';
import type { TraceBreakpoint } from '../typeshot/source-trace';

export interface TypeshotContext {
  readonly definitionInfoMap: Map<string, TypeDefinitionInfo>;
  readonly template: PrinterTemplate;
  pendingTrace: TraceBreakpoint | null;
  promise?: Promise<void>;
}

let current_typeshot_context: TypeshotContext | null = null;

export const getContext = () => {
  if (current_typeshot_context) return current_typeshot_context;
  throw new Error("no context found: make sure to use 'typeshot/program'");
};

export const runWithContext = async (
  filename: string,
  context: TypeshotContext,
  registerOptions?: RegisterOptions,
): Promise<TypeshotContext> => {
  if (current_typeshot_context) {
    throw new Error("context duplicatad: make sure to use 'typeshot/program'");
  }
  if (!path.isAbsolute(filename)) {
    throw new Error('filename should be absolute path');
  }
  try {
    if (!(REGISTER_INSTANCE in process)) register({ ...registerOptions, transpileOnly: true });
    current_typeshot_context = context;
    require(filename);
    await context.promise;
  } catch (e) {
    console.log(e instanceof Error ? e.message : e);
  }
  return context;
};
