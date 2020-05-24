# typeshot
[![npm version](https://badge.fury.io/js/typeshot.svg)](https://badge.fury.io/js/typeshot)

`typeshot` is a code generator like snapshot library, for TypeScript Declaration Files.

## Installation

```sh
$ npm i -D typeshot
$ npm i -D typescript prettier ts-node # You can skip them if already installed.
```

## Usage

### `typeshot.createType<Target, Props>([...parameters])`

This is the core API of `typeshot`. You can get TypeToken (token to print resolved type of `Target`).

When `Target` is a type reference and type arguments of the reference include the type `typeshot.T`, `typeshot.T` will be replaced with returned values type of given `parameters`. If there are multiple `typeshot.T`, they will be replaced from left to right. You can use `typeshot.T` in deeply nested type argument too.

`parameters` is array of function that recieves props and returns a value of parameter you inject to `Target`. The value will be internally converted into appropriate AST(Abstract Syntax Tree) node so that you don't have to use TypeScript Compiler API. See `typeshot.createParameter` section about how to set up `parameters`.

There are three kind of TypeToken (alias, interface and literal) and several approaches to get tokens.
```ts
const type = typeshot.createType<Target, Props>([...parameters]);

typeshot.print`
  // Target as type alias format, the name is 'TypeAsAlias'
  export ${type(props).alias('TypeAsAlias')}

  // Target as interface format, the name is 'TypeAsInterface'
  export ${type(props).interface('TypeAsInterface')}

  // Target as type literal format, you cannot name it since it's type literal
  export type TypeAsLiteral = ${type(props).literal()};
`;

const [First, Second, Third] = type(props).mapArray(['First', 'Second', 'Third']);
typeshot.print`
  // Target[0] as type alias format, the name is 'First'
  export ${First.alias}

  // Target[1] as interface format, the name is 'Second'
  export ${Second.interface}

  // Target[2] as type literal format, the named is 'Third' but ignored since the format is literal
  export type Third = ${Third.literal};
`;
console.log(First.property, First.name); // 0, 'First'
console.log(Second.property, Second.name); // 1, 'Second'
console.log(Third.property, Third.name); // 2, 'Third'

const { foo, bar, baz } = type(props).mapRecord({ foo: 'Foo', bar: 'Bar', baz: 'Baz' });
typeshot.print`
  // Target['foo'] as type alias format, the name is 'Foo'
  export ${foo.alias}

  // Target['bar'] as interface format, the name is 'Bar'
  export ${bar.interface}

  // Target['baz'] as type literal format, the named is 'Baz' but ignored since the format is literal
  export type Baz = ${baz.literal};
`;
console.log(foo.property, foo.name); // 0, 'Foo'
console.log(bar.property, bar.name); // 1, 'Bar'
console.log(baz.property, baz.name); // 2, 'Baz'
```

Please use it as `typeshot.createType` not `createType` in order to parse and inject needed values.

### `typeshot.createParameter<Parameter, Props>((props: P) => { ... })`

This helps to set up parameter function for the sake of `typeshot.createType`. The value of parameter have to be wrapped by `typeshot.solo`, `typeshot.union`, or `typeshot.intersection`. As their name, you can create Union Type and Intersection Type with `union` and `intersection`. `solo` is for single type.

### `typeshot.print`

This accumulates output contents immediately. You can use Type Token but a function.

### `typeshot.createPrinter<Props>`
This returns a printer function to accumulate output contents. You can use a function in template substitutions.

### `typeshot.createTemplate<Props>`
WIP

### `// typeshot-start` and `// typeshot-end` Comments

Lines before `// typeshot-start` and lines after `// typeshot-end` are kept in output file. Both are optional so that you can skip it.

Some types or values should still necessary in the output file. You can write such code by using these comments.

### `typeshot.config`

You can specify path of output file and header content of output file.

```ts
typeshot.config({ output: './sample.generated.ts' })`
// DO NOT EDIT - GENERATED FILE
`;
```



### Execution

There is no CLI for `typeshot` yet.

Typeshot find entry files via tsconfig. So you have to include typeshot files by your tsconfig.<br>
If you don't want to include them in your production tsconfig, you can create another tsconfig file for typeshot.
```ts
import runTypeshot from 'typeshot/program';

runTypeshot({ test: /\.typeshot\.ts$/ });
```

```sh
$ ts-node-transpile-only run-typeshot.ts
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
