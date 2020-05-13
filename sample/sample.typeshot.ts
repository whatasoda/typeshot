import typeshot from 'typeshot';
/** define output destination and header */
typeshot.configuration({ output: './sample.generated.ts' })`
// DO NOT EDIT - GENERATED FILE
`;

// typeshot-output-header
import type { Options } from 'prettier';
interface SomeInterface {}
type SomeType = {};

// typeshot-header

interface SomeTypeMap {
  hoge: SomeType;
  fuga: SomeInterface;
  prettier: Options;
}
type MappedType<T extends Record<string, any>> = {
  [K in keyof T]: { name: K; value: T[K] };
};

// typeshot-main
typeshot.takeStatic<MappedType<SomeTypeMap> /* target type */>('Hoge' /* internal key */, 'Hoge' /* name */)`
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

const dynamicSample = typeshot
  .createDynamic<Pick<MappedType<SomeTypeMap>, typeshot.T /* this will be replaced */>>('sample' /* internal key */)
  .parameters<DynamicSampleProps>(({ pick }) => [[pick] /* type parameter */])
  .names(({ name }) => name)`
  // ${({ description }) => description}
  ${({ name }) => (name === 'Sample' ? template : [])}
  export ${typeshot.TemplateSymbols.DECLARATION}
`;

dynamicSample({ name: 'Sample', description: 'hogehoge', pick: 'hoge' });
dynamicSample({ name: 'Sample0', description: 'fuga', pick: 'fuga' });

interface DynamicSample2Props {
  name: typeshot.NameDescriptor;
}

const dynamicSample2 = typeshot
  .createDynamic<MappedType<SomeTypeMap>>('sample2' /* internal key */)
  .parameters<DynamicSample2Props>(() => [])
  .names(({ name }) => name)`
  export ${typeshot.TemplateSymbols.DECLARATION}
`;
/* generate types of each properties */
dynamicSample2({ name: { hoge: 'HogeSelf', fuga: 'FugaSelf' } });

// typeshot-footer
// eslint-disable-next-line no-console
console.log();
// typeshot-output-footer
// eslint-disable-next-line no-console
console.log();
