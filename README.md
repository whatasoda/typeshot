# typeshot
[![npm version](https://badge.fury.io/js/typeshot.svg)](https://badge.fury.io/js/typeshot)

`typeshot` is a general purpose code generator for TypeScript, especially focusing to generate type definitions without complex advanced types and TypeScript Compiler API.

## Installation

```sh
$ npm i -D typeshot
$ npm i -D typescript prettier # You can skip them if already installed.
```

## Usage
Here is a sample code.

`./usage-example.ts`
```ts
import typeshot from 'typeshot';
import path from 'path';

typeshot.openTrace`
// DO NOT EDIT MANUALLY - GENERATED FILE
`;

export interface FileType {
  '.ts': object;
  '.tsx': string;
  '.png': Buffer;
  '.jpg': string;
}

typeshot.closeTrace();

const createFileInformationMap = typeshot.registerTypeDefinition((createTypeFragment, paths: string[]) => {
  const acc = Object.create(null);

  paths.forEach((p) => {
    const extname = path.extname(p) as keyof FileType;
    
    const fragment = createTypeFragment<{ [K in typeof p]: FileType[typeof extname] }>({ p, extname });
    
    Object.assign(acc, fragment);
  });

  return acc;
});

const paths: string[] = ['./foo/bar.ts', './baz/qux.png', './qux/baz.tsx', './bar/foo.jpg'];

typeshot.print`
// Hello, I'm comment.
export ${createFileInformationMap(paths).interface('FileInformationMap')}
`;
```

typeshot provides CLI command to evaluate source files. See [CLI Options](#CLI-Options) about CLI details.

```sh
typeshot --inputFile ./usage-example.ts --outDir ./results
```

`./results/usage-example.ts`
```ts
// DO NOT EDIT MANUALLY - GENERATED FILE

export interface FileType {
  '.ts': object;
  '.tsx': string;
  '.png': Buffer;
  '.jpg': string;
}

// Hello, I'm comment.
export interface FileInformationMap {
  './foo/bar.ts': object;
  './baz/qux.png': Buffer;
  './qux/baz.tsx': string;
  './bar/foo.jpg': string;
}
```

## API

### `registerTypeDefinition`

#### Example
```ts
const createFileInformationMap = typeshot.registerTypeDefinition((createTypeFragment, paths: string[]) => {
  const acc = Object.create(null);

  paths.forEach((p) => {
    const extname = path.extname(p) as keyof FileType;
    
    const fragment = createTypeFragment<{ [K in typeof p]: FileType[typeof extname] }>({ p, extname });
    
    Object.assign(acc, fragment);
  });

  return acc;
});
```

`typeshot.registerTypeDefinition` is a core API to create custom type definitions. It receives a function to describe type definition and returns a function to instantiate type definition. `typeshot` converts returned value of the describer function into type definitions by parsing the value down to `TypeFragment` and usual values and evaluating them. You can see how `typeshot` evaluates `TypeFragment` and values, by enabling a CLI Option `-E`/`--emitIntermediateFiles`.

The describer function receives a utility function called `createTypeFragment` and rest arguments which come from the instantiator function. There are two steps to instantiate type definitions, the first step is to pass arguments that the describer function requires, and the second step is to specify type format and type name.

In this example, it passes `paths` to describer function and specifies to output the instance as interface named `FileInformationMap`. Make sure to use `typeshot.print` to commit instances to the result.
```ts
typeshot.print`
// Hello, I'm comment.
export ${createFileInformationMap(paths).interface('FileInformationMap')}
`;
```

#### `TypeFragment`
`TypeFragment` is a special object which contains information to connect values and types.

Connecting values and types means that it's able to use actual values to certain parts in type annotations. Let's see an example.
```ts
const fragment = createTypeFragment<{ [K in typeof p]: FileType[typeof extname] }>({ p, extname });
```
`createTypeFragment` accepts one type argument and one argument. In the type argument, all type queries (`typeof p` and `typeof extname`) will be replaced with values received from argument. In this example, if `p` is './foo/bar.ts' and `extname` is `.ts`, then the type argument is internally evaluated as like this:
```ts
{ [K in './foo/bar.ts']: FileType['.ts'] }
```

Note that the names of type query target must match with the keys of object at the argument.

#### Intersection Types
As the example does, you can merge `TypeFragment` into a one object. Merged object is evaluated as an intersection type. In this example, it's internally evaluated as like this:
```ts
& { [K in './foo/bar.ts']: FileType['.ts'] }
& { [K in './baz/qux.png']: FileType['.png'] }
& { [K in './qux/baz.tsx']: FileType['.tsx'] }
& { [K in './bar/foo.jpg']: FileType['.jpg'] }
```

#### General Values
`registerTypeDefinition` evaluates not only `TypeFragment`, but also normal values, into type definition.

Primitive values like string, number, boolean, undefined, and null are evaluated into literal type.
Object-like values are evaluated recursively while keeping the structure of object.

#### Tuple Types
You can define tuple type by returning values via an array.
```ts
const example = typeshot.registerTypeDefinition(() => {
  return ['foo', 'bar', 'baz'];
});

typeshot.print`
type Example = ${example().literal()};
`;
```
This example will be evaluated into `type Example = ['foo', 'bar', 'baz'];`.

#### Union Types
You can define union types by using `typeshot.union`.
```ts
const example = typeshot.registerTypeDefinition(() => {
  return typeshot.union(['foo', 'bar', 'baz']);
});

typeshot.print`
type Example = ${example().literal()};
`;
```
This example will be evaluated into `type Example = 'foo' | 'bar' | 'baz';`.

### `print`
`typeshot.print` is a tag function to commit type definition instance to result.

As the example does, it accepts extra contents to add comments, modifiers, etc.
```ts
typeshot.print`
// Hello, I'm comment.
export ${createFileInformationMap(paths).interface('FileInformationMap')}
`;
```

### `openTrace`, `closeTrace`
You can copy and paste lines from source file to result file by using `openTrace` and `closeTrace`.

`typeshot` copies lines between `openTrace` and `closeTrace`, and paste to result file. You can also specify extra content by Tagged Template Literal.
```ts
typeshot.openTrace`
// DO NOT EDIT MANUALLY - GENERATED FILE
`;

export interface FileType {
  '.ts': object;
  '.tsx': string;
  '.png': Buffer;
  '.jpg': string;
}

typeshot.closeTrace();
```

## CLI Options

```
typeshot [--outFile <path> | --outDir <path>] [--basePath <path>] [--rootDir <dir>] [--project <path>]
          [--prettierConfig <path>] [--systemModule <path>] [--maxParallel <count>] [--emitIntermediateFiles]
          [--inputFile <path> | [--] <path>...]
```

| Flag(Shorthand) | Default | Descriptions |
|:---- |:---- |:---- |
|`--inputFile`(`-i`)            | -                 | input file path |
|`--outFile`(`-o`)              | -                 | output file path, make sure to use with `--inputFile` |
|`--outDir`(`-O`)               | -                 | output directory path |
|`--basePath`(`-b`)             | `process.cwd()`   | base path to resolve relative paths |
|`--rootDir`                    | basePath          | root directory to resolve output file path with outDir |
|`--project`(`-p`)              | `'tsconfig.json'` | tsconfig path |
|`--prettierConfig`             | -                 | prettier config path |
|`--systemModule`               | `'typescript'`    | see [System Module](#System-Module) |
|`--maxParallel`                | 3                 | max number of subprocess |
|`--emitIntermediateFiles`(`-E`)| false             | whether to emit intermediate files |
|&lt;rest arguments&gt;         | -                 | input file paths |

## System Module
`typeshot` supports injecting custom file system adapter by specifying `--systemModule` option. `typeshot` uses `require('typescript').sys` by default. But if you want to use custom behavior to pass custom file content, or to receive result files without emitting, you can specify path to your custom system module.

Make sure to export the implementation with name `sys`.

## TODO
- add missing tests
- support async execution

## Committers

 * Shota Hatada ([@whatasoda](https://github.com/whatasoda))

## License

Copyright 2020 Shota Hatada

Licensed under the MIT License.
