import typeshot from 'typeshot';
/** define output destination and header */
typeshot.config({ output: './test.generated.ts' })`
// DO NOT EDIT - GENERATED FILE
`;

import type { Options } from 'prettier';
interface SomeInterface {}
type SomeType = {};

import './readme/another-file';
// eslint-disable-next-line prettier/prettier
export type a = import(    './readme/another-file'  ).Type;
export const a = import('./readme/another-file');

// typeshot-start
interface SomeTypeMap {
  hoge: SomeType;
  fuga: SomeInterface;
  prettier: Options;
}
type MappedType<T extends Record<string, any>> = {
  [K in keyof T]: { name: K; value: T[K] };
};

const Hoge = typeshot.createType<MappedType<SomeTypeMap>>([])({}).interface('Hoge');
typeshot.print`
  export ${Hoge}
`;

interface DynamicSampleProps {
  name: string;
  description: string;
  pick: string;
}

const template = typeshot.createTemplate<DynamicSampleProps>`
  // ${({ name }) => name}
`;

const pick = typeshot.createPrameter<string, DynamicSampleProps>(({ pick }) => typeshot.solo(pick));

const dynamicSample = typeshot.createType<Pick<MappedType<SomeTypeMap>, typeshot.T>, DynamicSampleProps>([pick]);

const printDynamicSample = typeshot.createPrinter<DynamicSampleProps>`
  // ${({ description }) => description}
  ${({ name }) => (name === 'Sample' ? template : [])}
  export ${(p) => dynamicSample(p).alias(p.name)}
  export type _${(p) => p.name} = ${(p) => dynamicSample(p).property(p.pick, '').literal}
`;

printDynamicSample({ name: 'Sample', description: 'hogehoge', pick: 'hoge' });
printDynamicSample({ name: 'Sample0', description: 'fuga', pick: 'fuga' });
