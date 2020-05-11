import typeshot from 'typeshot';

typeshot.configuration({ output: './sample.generated.ts' })`
// DO NOT EDIT - GENERATED FILE
`;
// typeshot-output-header

// eslint-disable-next-line no-console
console.log('Loaded Generated File!');

// typeshot-header
import type { Type, GenericType } from './another-file';
type EntryMap<T extends object> = {
  [K in keyof T]: readonly [K, T[K]];
};

// typeshot-main
typeshot.takeStatic<typeshot.Expand<Type>>('UniqueKey-0', 'TypeName')`
// Descriptions of '${typeshot.TemplateSymbols.NAME}'
export ${typeshot.TemplateSymbols.DECLARATION}
export type ${typeshot.TemplateSymbols.NAME}Array = ${typeshot.TemplateSymbols.NAME}[];
export const ${typeshot.TemplateSymbols.NAME}__sample: ${typeshot.TemplateSymbols.NAME} = { /* ... */ } as any;
`;

typeshot.takeStatic<EntryMap<Type>>('UniqueKey-1', 'TypeNameForEntryMap')`
export ${typeshot.TemplateSymbols.DECLARATION}
`;

interface DynamicTypeshotProps {
  param: string;
}
const takeDynamic = typeshot
  .createDynamic<GenericType<typeshot.T>>('UniqueKey-2')
  .parameters<DynamicTypeshotProps>(({ param }) => [[param]])
  .names(({ param }) => `GenericType__${param.toUpperCase()}`)`
// ${({ param }) => param}
export ${typeshot.TemplateSymbols.DECLARATION}
`;

takeDynamic({ param: 'foo' });
takeDynamic({ param: 'bar' });
