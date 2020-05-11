# typeshot

`typeshot` is a code generator like snapshot library, for TypeScript Declaration Files.

## Installation

```sh
$ npm i -D typeshot
$ npm i -D typescript prettier ts-node # You can skip them if already installed.
```

## Usage

### Example

#### `sample.typeshot.ts`

Register types that you want to take snapshot.

```ts
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

const stringParam = typeshot.createPrameter<DynamicTypeshotProps, string>(({ param }) => [param]);

const takeDynamic = typeshot
  .createDynamic<GenericType<typeshot.T>>('UniqueKey-2')
  .parameters<DynamicTypeshotProps>([stringParam])
  .names(({ param }) => `GenericType__${param.toUpperCase()}`)`
// ${({ param }) => param}
export ${typeshot.TemplateSymbols.DECLARATION}
`;

takeDynamic({ param: 'foo' });
takeDynamic({ param: 'bar' });
```

#### `another-file.ts`

This is dependency file that is loaded from `sample.typeshot.ts`.

```ts
export interface Type {
  foo: string;
  bar: {
    baz: number;
    qux: Date;
  };
}

export type GenericType<T extends string> = {
  [K in T]: { type: K };
};
```

#### run-typeshot.ts
There is no CLI for `typeshot` yet.
```ts
import runTypeshot from 'typeshot/program';

runTypeshot({ test: /\.typeshot\.ts$/ });
```

Execute via `ts-node`

```sh
$ ts-node --files run-typeshot.ts
```

#### `sample.generated.ts`

This is the output file of `typeshot` with `sample.typeshot.ts`.

```ts
// DO NOT EDIT - GENERATED FILE
// typeshot-output-header
// eslint-disable-next-line no-console
console.log('Loaded Generated File!');
// Descriptions of 'TypeName'
export type TypeName = {
  foo: string;
  bar: {
    baz: number;
    qux: Date;
  };
};
export type TypeNameArray = TypeName[];
export const TypeName__sample: TypeName = {
  /* ... */
} as any;

export type TypeNameForEntryMap = {
  foo: readonly ['foo', string];
  bar: readonly [
    'bar',
    {
      baz: number;
      qux: Date;
    },
  ];
};

// foo
export type GenericType__FOO = {
  foo: {
    type: 'foo';
  };
};

// bar
export type GenericType__BAR = {
  bar: {
    type: 'bar';
  };
};

export {};
```

### API

#### `typeshot.takeStatic`

This is the most basic usage of `typeshot`. You can take a snapshot of type.

```ts
typeshot.takeStatic<SnapshotEntryType>('Unique Key', 'TypeName')`
// output code as string
${typeshot.TemplateSymbols.NAME}
${typeshot.TemplateSymbols.CONTENT}
${typeshot.TemplateSymbols.DECLARATION}
`;
```
The type parameter at where `SnapshotEntryType` is placed, is the entry. `typeshot` serialize actual type structure of the entry.

The first argument is a key as pure string literal, don't use template string. Each key should be unique in the file.

The second argument is name of generated type.

The tail of statement, tagged template string is written in output after symbols are replaced with generated type. It is described later section about symbols.

#### `typeshot.createDynamic`
```ts
interface DynamicTypeshotProps {
  param: string;
}
const stringParam = typeshot.createPrameter<DynamicTypeshotProps, string>(({ param }) => [param]);
const takeDynamic = typeshot
  .createDynamic<GenericType<typeshot.T>>('UniqueKey')
  .parameters<DynamicTypeshotProps>([stringParam])
  .names(({ param }) => param.toUpperCase())`
// ${({ param }) => param}
export ${typeshot.TemplateSymbols.DECLARATION}
`;

takeDynamic({ param: 'foo' });
takeDynamic({ param: 'bar' });
```

The difference from `typeshot.takeStatic` is that the second argument doesn't exist, two extra phases `parameters` and `names` are added, `typeshot.T` is available in entry type, and function is available in tagged template.

The `parameters` phase is for specifying replacement of `typeshot.T`.<br>
You can use `typeshot.T` multiple times. The order that aliases are replaced is left to right, even if the entry type is deeply nested.<br>
I recommend you to prepare type injection with `typeshot.createParameter`. It helps you to create injection with value typed correctly.

The `name` phase is for specifying name of generated type.<br>
You can use two kinds of name descriptors. One is to use string as same as the second argument of `takeStatic`.<br>
Another one is object(`Record<string, string>`) or array(`string[]`). When you use this way, the generated type is not entry type itself. `typeshot` use each type of property that is referred with keys of the object or array, and value of the key will be used as name.

As the example, you can use function in the tagged template.

You can set the type of argument of each function in the type parameter of `parameters` phase.

#### `typeshot.configuration`

You can specify path of output file and header content of output file.

```ts
typeshot.configuration({ output: './sample.generated.ts' })`
// DO NOT EDIT - GENERATED FILE
`;
```

#### Symbols
| group           | name        | description |
|:--------------- |:----------- |:----------- |
|`TemplateSymbols`|`NAME`       | name of output type |
|                 |`CONTENT`    | content of output type, generally object literal |
|                 |`DECLARATION`| completed content of output type, as type alias |

#### Types
| name            | description |
|:--------------- |:----------- |
|`typeshot.T`     | Type alias that will be replaced by dynamic parameter. See `typeshot.createDynamic` section about detail. |
|`typeshot.Expand`| Generic type that helps to serialize types declared as `interface`.<br> For example, if `Type` in the example above was not wrapped with `typeshot.Expand`, it is serialized to `Type`, not object literal. |

### Section Comments

`typeshot` splits input file into several sections by spesific comments. Supports only single line comment.
```ts
console.log('unknown, will be ignored');

// section-comment-A
console.log('section A start');
/* statements */
console.log('section A end');

// section-comment-B
console.log('section B start');
/* statements */
console.log('section B end');
```

Statements in each section are treated in different way.

| section name           | kept or not in output | what kind of code should be written |
|:---------------------- |:--------------------- |:----------------------------------- |
|before sections         | removed               | used by also generated code (**transformed** `main`) |
|`typeshot-output-header`| kept on the top       | used by also generated code (**transformed** `main`) |
|`typeshot-header`       | removed               | used by only **raw** `main` section |
|`typeshot-main`         | removed               | `typeshot`'s code |
|`typeshot-footer`       | removed               | used by only **raw** `main` section |
|`typeshot-output-footer`| kept on the bottom    | used by also generated code (**transformed** `main`) |


### Execution

There is no CLI for `typeshot` yet.

Typeshot find entry files via tsconfig. So you have to include typeshot files by your tsconfig.<br>
If you don't want to include them in your production tsconfig, you can create another tsconfig file for typeshot.
```ts
import runTypeshot from 'typeshot/program';

runTypeshot({ test: /\.typeshot\.ts$/ });
```

```sh
$ ts-node --files run-typeshot.ts
```

#### Options

| name            | type    | description |
|:--------------- |:------- | :---------- |
|`test`           | RegExp  | **required**, pattern of typeshot file |
|`project`        | string  | optional, path to `tsconfig.json` |
|`prettierOptions`| object  | optional, options of `prettier` |
|`basePath`       | string  | optional, base path to find `tsconfig.json` and `.prettierrc` if they are ommited |

## TODO
- implement CLI

## Committers

 * Shota Hatada ([@whatasoda](https://github.com/whatasoda))

## License

Copyright 2020 Shota Hatada

Licensed under the MIT License.
