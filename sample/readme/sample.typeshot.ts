import typeshot from 'typeshot';

typeshot.config({ output: './generated/sample.ts' })`
// DO NOT EDIT - GENERATED FILE
`;

// eslint-disable-next-line no-console
console.log('Start Loading Generated File!');

// typeshot-start
import type { Type, GenericType } from './another-file';

/**
 * This helps interface to be expanded format.
 * Or for intersection type, this helps it to be unified type literal.
 */
type Expand<T> = { [K in keyof T]: T[K] };

const sampleStatic = typeshot.createType<Expand<Type>>([]);
typeshot.print`
// You can write comments here.
export ${sampleStatic({}).alias('SampleType')}
export type SampleTypeArray = SampleType[];
export const SampleType__sample = { foo: 'foo', bar: { baz: 0, qux: new Date() } } as any;
`;

interface DynamicTypeshotProps {
  name: string;
  param: string;
}
const stringParam = typeshot.createPrameter<string, DynamicTypeshotProps>(({ param }) => typeshot.solo(param));

const dynamicSample = typeshot.createType<GenericType<typeshot.T>, DynamicTypeshotProps>([stringParam]);

const printDynamic = typeshot.createPrinter<DynamicTypeshotProps>`
  export ${(p) => dynamicSample(p).alias(`${p.name}Alias`)}
  export ${(p) => dynamicSample(p).interface(`${p.name}Interface`)}
  export type ${(p) => p.name} = {
    fooo: ${(p) => dynamicSample(p).literal()};
  };
`;

printDynamic({ name: 'Foo', param: 'foo' });
printDynamic({ name: 'Bar', param: 'bar' });

// typeshot-end
// eslint-disable-next-line no-console
console.log('Finish Loading Generated File!');
