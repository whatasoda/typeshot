import typeshot from 'typeshot';
/** define output destination and header */
typeshot.configuration({ output: './sample.generated.ts' })`
// DO NOT EDIT - GENERATED FILE
`;

import type { Options } from 'prettier';
interface SomeInterface {}
type SomeType = {};

// typeshot-start
interface SomeTypeMap {
  hoge: SomeType;
  fuga: SomeInterface;
  prettier: Options;
}
type MappedType<T extends Record<string, any>> = {
  [K in keyof T]: { name: K; value: T[K] };
};

typeshot.printStatic<MappedType<SomeTypeMap> /* target type */>('Hoge' /* name */)`
  export ${typeshot.TemplateSymbols.DECLARATION}
`;

interface DynamicSampleProps {
  name: string;
  description: string;
  pick: string;
}

const template = typeshot.createTemplate<DynamicSampleProps>`
  // ${typeshot.TemplateSymbols.NAME}
`;

const pick = typeshot.createPrameter<DynamicSampleProps, string>(({ pick }) => [pick]);

const dynamicSample = typeshot.createDynamic<Pick<MappedType<SomeTypeMap>, typeshot.T>, DynamicSampleProps>([pick]);
const printDynamicSample = dynamicSample(({ name }) => name)`
  // ${({ description }) => description}
  ${({ name }) => (name === 'Sample' ? template : [])}
  export ${typeshot.TemplateSymbols.DECLARATION}
`;

printDynamicSample({ name: 'Sample', description: 'hogehoge', pick: 'hoge' });
printDynamicSample({ name: 'Sample0', description: 'fuga', pick: 'fuga' });

interface DynamicSample2Props {
  name: typeshot.NameDescriptor;
}

const dynamicSample2 = typeshot.createDynamic<MappedType<SomeTypeMap>, DynamicSample2Props>([]);
const printDynamicSample2 = dynamicSample2(({ name }) => name)`
  export ${typeshot.TemplateSymbols.DECLARATION}
`;
/* generate types of each properties */
printDynamicSample2({ name: { hoge: 'HogeSelf', fuga: 'FugaSelf' } });

// eslint-disable-next-line no-console
console.log();
// typeshot-end
// eslint-disable-next-line no-console
console.log();
