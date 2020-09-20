# typeshot
[![npm version](https://badge.fury.io/js/typeshot.svg)](https://badge.fury.io/js/typeshot)

`typeshot` is a code generator like snapshot library, for TypeScript Declaration Files.

## Installation

```sh
$ npm i -D typeshot
$ npm i -D typescript prettier ts-node # You can skip them if already installed.
```

## Motivation

When TypeScript developers work on Data-Driven Development, automation of type definitions is an important issue. Even if JavaScript implementation is ruled by schema or such data, until type definition is not so, developers stay busy with extra chores to update type definitions. Developers should set up automation of type definition and reduce the extra chores. If they achieved it, they can use their saved resources, for the sake of other tasks.

## Existing Approaches

In order to achieve automation, there are two ways. Let's name them to clarify description.
- **Acrobat Type Resolution**
  - Create needed types via Type Resolution with combinations of advanced types such as Mapped Type and Conditional Type.
- **AST Code Generation**
  Generate code by manipulating Abstract Syntax Tree with TypeScript Compiler API.

However, there is much pain. Before describing the pain, let's see required steps to automate type definition.

1. **Collection**
    - Collect needed values from source data.
1. **Transformation**
    - Transform the values into proper format.
    - You can also filter or do extra operations here.
1. **Construction**
    - Construct types from transformed values.

### **Acrobat Type Resolution**
Let's start from the pain with **Acrobat Type Resolution**.<br>
Basically, there is a pain in all steps. If it's a small range of automation, it's acceptable to maintain and operate. But once complexity increases, the difficulty will also increase.<br>
Firstly, in the **Collection** step, you have to collect values as Literal Type (like String Literal). To do that, you need to use `as const` or type inferences.

with `as const`
```ts
const val = [
  { id: 'foo', type: 'text' },
  { id: 'bar', type: 'count' },
] as const;
type Val = typeof val[number]; // { readolny id: 'foo'; readolny type: 'text' } | { readolny id: 'bar'; readolny type: 'count' }
```
Looks good at first glance, but you cannot get supported about type check with TypeScript when you write schema. So it unfortunately increases developers' responsibility.

with type inference (Just a reference. You don't have to understand it.)
```ts
type OneOfType = 'text' | 'count';
interface EntryForInference<T extends string, U extends OneOfType> {
  id: T;
  type: U;
}
const fn = <T extends string, U extends OneOfType, V extends EntryForInference<T, U>[]>(
  schemaSet: V & EntryForInference<T, U>[],
): V => schemaSet;

const val = fn([
  { id: 'foo', type: 'text' },
  { id: 'bar', type: 'count' },
]);
type Val = typeof val[number]; // { id: 'foo'; type: 'text' } | { id: 'bar'; type: 'count' }
```
It's hard to set up this approach, it may not work depending on complexity.

**Transformation** and **Construction** will be done together in **Acrobat Type Resolution**. In these steps, you will a lot of Mapped Type and Conditional Type, and readability will decrease. Additionally, it may not work because TypeScript may stop Type Resolution if you try to do too complex operation.

There is one more issue in **Construction** in **Acrobat Type Resolution**. We cannot see any content of resolved type in remote repository such as GitHub. We need to hover mouse cursor in a text editor which supports TypeScript.

### **AST Code Generation**
Next, Let's see the pain with **AST Code Generation**.<br>
We can say there is almost no pain within **Collection** step and **Transformation** step. What we collect is just real values (not types), we can write transformation with executable JavaScript code. In the first place, where we use AST or code generation is only **Construction** step. For the other two steps, it's just **executable JavaScript code**, you can easily test and debug it.<br>
Instead, there is a learning cost about TypeScript Compiler API, for **Construction** step. It's so heavy cost, so it's hard to adopt while developing your product.

Based on this, we can say the cost of **Construction** step in **Acrobat Type Resolution** is lower than **AST Code Generation**, because knowledge about the **Construction** step in **Acrobat Type Resolution** is useful in other wide situations.

### `typeshot`
Although those both two approaches have big issues, it seems there may be acceptable points in each step.<br>
You can arrange easily **Collection** and **Transformation** if you can write code that is executable with JavaScript.<br>
For **Construction**, **Type Resolution** is suitable. You can create enough type with only Mapped Type and several builtin types if you do enough **Transformation**.

If you can use them at the same time, and choose a suitable way for each step, you can adopt the automation of type definitions. `typeshot` helps you to achieve that.

## Get Started

Here show rough steps to generate code with `typeshot`.
1. **Design**
    - Design needed types and values
1. **Create Type Parameter Factories**
    - Prepare functions that treat JavaScript values as type parameters
1. **Create Source Data**
    - Prepare values to use for code generation
1. **Collect Type Definitions**
    - Pass information of type and type parameters and Receive a token object
1. **Code Generation**
    - Generate code based on string values with Using token objects

Note: To avoid confusing the terms, I call "Type Argument" as "Type Parameter".

From here, I'll explain how to use `typeshot` while omitting detailed internal behavior. For easily understood, let's start from **Code Generation** part.

### **Code Generation**
Basically, `typeshot` prints given string values ​​to files as it is. It uses Tagged Template Literal, as same way as `styled-components` and `graphql-tag`, to receive string values. Therefore, you can achieve code generation easily like writing actual code. You don't need any knowledge about AST(Abstract Syntax Tree).

```ts
// source
typeshot.print`
const sample = { foo: 'foo', bar: 'bar' };
`;
```
```ts
// output
const sample = { foo: 'foo', bar: 'bar' };
```

Because it uses Tagged Template Literal, you can generate code dynamically like:<br>
```ts
// source
const keys = ['foo', 'bar'];
typeshot.print`
const sample = { ${keys.map((key) => `${key}: '${key}'`).join(', ')} };
`;
```
```ts
// output
const sample = { foo: 'foo', bar: 'bar' };
```
However, we cannot achieve to generate type definitions unless writing them as string values, with only this. `typeshot` can collect type definition information via `createType`, to realize it.

### **Collect Type Definitions**
In this section, I'll explain with this code:
```ts
// source
type Expand<T> = { [K in keyof T]: T[K] };

interface Input {
  foo: string;
  bar: number;
}
const input = typeshot.createType<Expand<Input>, {}>([]);

typeshot.print`
  export ${input({}).alias('ResultAlias')};
  export ${input({}).interface('ResultInterface')};
  let val: ${input({}).literal()};
`;
```
```ts
// output
export type ResultAlias = { foo: string; bar: number };
export interface ResultAlias {
  foo: string;
  bar: number;
}
let val: { foo: string; bar: number };
```
`createType` receives two type parameters and one argument. Because I'll explain only how to generate static type definition, you can focus only on the first type parameter, let's see the roles of all of them quickly.

The first type parameter is for the type you want to use. (`Expand<Input>` in this case)
The second type parameter is the type that source data of dynamic type definition generation should meet.
The argument is for an array of Type Parameter Factories for dynamic type definition generation.

`typeshot` connects between information on type system and value on execution via static analysis. The connection doesn't mean the value meets the type, but it means the value is what identifies the type information. I named the object, that keeps the connection and kind of how to print type, as **Type Token**. `createType` returns a function to create Type Token, not Type Token itself. You have to call the function twice. The first call is for passing source data of dynamic type definition generation, and the second call is for specifying how to print type.

```ts
typeshot.print`
  export ${input({}).alias('ResultAlias')};
  export ${input({}).interface('ResultInterface')};
  let val: ${input({}).literal()};
`;
```
Though the argument on the first call must meet the second type parameter of `createType`, using empty object since it's static type definition generation here.

On the second call, you can choose an output format from `alias`, `interface` and `literal`. `literal` is especially necessary to generate code freely. It's useful in various cases such as printing to type declaration of a variable directly like this example. Though `literal` doesn't require any arguments since it never has a name, you need to pass a name for `alias` and `interface`.

```ts
type Expand<T> = { [K in keyof T]: T[K] };

interface Input {
  foo: string;
  bar: number;
}
const input = typeshot.createType<Expand<Input>, {}>([]);
```

In this example, it uses a Genetic Type `Expand`. You may think it does nothing, but it does essential operation to print `Input`, that is defined as an interface, in this format `{ foo: string; bar: number }`. If you don't use `Expand` here, the result will be:
```ts
export type ResultAlias = Input;
export interface ResultAlias extends Input {}
let val: Input;
```
The following explains this behavior along with a little bit of background because it is important when you use `typeshot`.<br>
If you use a text editor that supports TypeScript, you have ever seen detailed content of type alias and others by hovering mouse cursor. `typeshot` does similar things that editor does to show such details. However you should see nothing but names in the case of interface, so then you need to change the internal recognition from as interface to as type literal by using `Expand`. Besides that, `Expand` is useful to prettify the intersection type.

### **Create Source Data**
It's as its name is. Prepare values to match Type Parameter Factories.

### **Create Type Parameter Factories**
```ts
type Construct<T extends Entry> = {
  [K in T['id']]: ValueMap[Extract<T, { id: K }>['type']];
};

interface ValueMap {
  text: string;
  count: number;
}

interface Entry {
  id: string;
  type: keyof ValueMap;
}

const param = typeshot.createParameter<Entry, Entry[]>((entries) => {
  return typeshot.union(entries);
});

const construct = typeshot.createType<Construct<typeshot.T>, Entry[]>([param]);

const entries: Entry[] = [
  { id: 'foo', type: 'text' },
  { id: 'bar', type: 'count' },
];

typeshot.print`
  export ${construct(entries).interface('Result')}
`;
```
It's getting complex, let's see the result first.
```ts
export interface Result {
  foo: string;
  bar: number;
}
```

The most important part is this Generic Type `Construct`.
```ts
type Construct<T extends Entry> = {
  [K in T['id']]: ValueMap[Extract<T, { id: K }>['type']];
};

interface ValueMap {
  text: string;
  count: number;
}
```
`Construct` creates object type based on received entries via the type parameter `T`. In this example, `Construct` will receive `{ id: 'foo'; type: 'text' } | { id: 'bar'; type: 'count' }`, so let's continue explanation with the premise that `Construct` receives this type.

1. `T['id']` will be treated as `'foo' | 'bar'`.
1. When `K` is `'foo'`, `Extract<T, { id: K }>` will pick up `{ id: 'foo'; type: 'text' }` from the original Union Type.
1. Therefore, `Extract<T, { id: K }>['type']` will be treated as `{ id: 'foo'; type: 'text' }['type']`, namely `'text'`.
1. Hence, `ValueMap[Extract<T, { id: K }>['type']]` will be treated as `ValueMap['text']`, and the result will become `string`.
1. When `K` is `'bar'`, it will be resolved as well as `'foo'`, the result will become `number`.
1. Finally, `Construct` creates a type like `Result` in the example.

Next, about `createParameter`
```ts
const param = typeshot.createParameter<Entry, Entry[]>((entries) => {
  return typeshot.union(entries);
});
```
The role of this function is to define a content of type parameter. As well as `createType`, it receives two type parameters.<br>
The first one is what the type parameter, that you want to create, should meet, so set it `Entry` that `T` does extends in `Construct`.<br>
The second one is for the type of argument that you want to use in the factory. This, the second one, should be matched with the second argument of `createType`.

`typeshot.union` is in order to specify to define received values as a Union Type. In this example, it receives the array `Entry[]` and define them as a Union Type that inherits `Entry` (not an array).<br>
Besides that, there are `typeshot.intersection` for Intersection Type and `typeshot.solo` for single types that are neither.<br>

Additionally, you can apply transforms like filtering values, in the factory. Though there are no such operations in this example, for another example, you can add a property like `required` to `Entry` and filter entries to include only ones which `required` is `true`. Then you can generate type that includes only specific entries.

About `typeshot.createType`, especially the part of dynamic type definition generation, that is omitted in previous section.
```ts
const construct = typeshot.createType<Construct<typeshot.T>, Entry[]>([param]);
```
While being that `createParamter` is responsible to define the content of type parameter, `createType` is supposed to decide which type parameter will be injected. `typeshot` looks for `typeshot.T` from type parameters of the first type parameter, and replace them with types that are created with given factories. If the first type parameter has multiple `typeshot.T` like `Pick<Construct<typeshot.T>, typeshot.T>`, they will be replaced from left to right, regardless nests.

```ts
const entries: Entry[] = [
  { id: 'foo', type: 'text' },
  { id: 'bar', type: 'count' },
];

typeshot.print`
  export ${construct(entries).interface('Result')}
`;
```

In this example, it passes `entries` that is the source value of dynamic type definition generation. Then, `typeshot` internally create a type `Construct<{ id: 'foo'; type: 'text' } | { id: 'bar'; type: 'count' }>` and evaluate it. After you get this, you can generate type definitions dynamically by specify the output format as described in previous section.

### **Design**

Based on sections until here, design types like `Construct` and `Entry`.

## Usage
<!-- 
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
WIP -->

### `// typeshot-start` and `// typeshot-end` Comments

Lines before `// typeshot-start` and lines after `// typeshot-end` are kept in output file. Both are optional so you can skip it.

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
- support async execution

## Committers

 * Shota Hatada ([@whatasoda](https://github.com/whatasoda))

## License

Copyright 2020 Shota Hatada

Licensed under the MIT License.
