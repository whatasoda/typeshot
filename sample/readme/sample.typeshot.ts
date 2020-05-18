import typeshot from 'typeshot';

typeshot.configuration({ output: './generated/sample.ts' })`
// DO NOT EDIT - GENERATED FILE
`;

// eslint-disable-next-line no-console
console.log('Loaded Generated File!');
import './another-file';
// eslint-disable-next-line prettier/prettier
export type a = import(    './another-file'  ).Type;
export const a = import('./another-file');

// typeshot-start
import type { Type, GenericType } from './another-file';
type EntryMap<T extends object> = {
  [K in keyof T]: readonly [K, T[K]];
};

typeshot.takeStatic<typeshot.Expand<Type>>('TypeName')`
// Descriptions of '${typeshot.TemplateSymbols.NAME}'
export ${typeshot.TemplateSymbols.DECLARATION}
export type ${typeshot.TemplateSymbols.NAME}Array = ${typeshot.TemplateSymbols.NAME}[];
export const ${typeshot.TemplateSymbols.NAME}__sample: ${typeshot.TemplateSymbols.NAME} = { /* ... */ } as any;
`;

typeshot.takeStatic<EntryMap<Type>>('TypeNameForEntryMap')`
export ${typeshot.TemplateSymbols.DECLARATION}
`;

const stringParam = typeshot.createPrameter<DynamicTypeshotProps, string>(({ param }) => [param]);

interface DynamicTypeshotProps {
  param: string;
}
const takeDynamic = typeshot
  .createDynamic<GenericType<typeshot.T>>()
  .parameters<DynamicTypeshotProps>([stringParam])
  .names(({ param }) => `GenericType__${param.toUpperCase()}`)`
// ${({ param }) => param}
export ${typeshot.TemplateSymbols.DECLARATION}
`;

takeDynamic({ param: 'foo' });
takeDynamic({ param: 'bar' });
// typeshot-end
'aa';
