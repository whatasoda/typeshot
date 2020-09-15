import ts from 'typescript';
import { REGISTER_INSTANCE, register, RegisterOptions } from 'ts-node';
import type { Config, TypeDefinition, TypeToken } from './typeshot';

export interface TypeshotContext {
  readonly definitions: Map<string, TypeDefinition>;
  readonly template: (string | TypeToken)[];
  header?: string;
  config?: Config;
  promise?: Promise<void>;
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

export const getCurrentContext = () => {
  const context = CURRENT_TYPESHOT_CONTEXT.current;
  if (context) return context;
  throw new Error('Context Missed: Make sure to run via typeshot program');
};

const runWithContext = async (
  filename: string,
  context: TypeshotContext,
  registerOptions?: RegisterOptions,
): Promise<TypeshotContext> => {
  if (CURRENT_TYPESHOT_CONTEXT.current) {
    throw new Error('Invalid Operation: typeshot cannot evaluate multiple files at the same time in the same context');
  }
  try {
    if (!(REGISTER_INSTANCE in process)) register(registerOptions);
    CURRENT_TYPESHOT_CONTEXT.current = context;
    require(filename);
    await context.promise;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
  }
  return context;
};

export default runWithContext;
