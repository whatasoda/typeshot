export * from './printer';
export * from './register-type-definition';
export { closeTrace, openTrace, SourceTraceTemplate } from './source-trace';
export { TypeInstance, TypeInstanceFactory } from './type-instance';
export * from './type-kind';

export type Typeshot = typeof import('.');
export type Integrate<T> = { [K in keyof T]: T[K] };
