# typeshot
[![npm version](https://badge.fury.io/js/typeshot.svg)](https://badge.fury.io/js/typeshot)

`typeshot`は型定義を含むTypeScriptのコード生成を支援するライブラリです。

## Installation

```sh
$ npm i -D typeshot
$ npm i -D typescript prettier ts-node # 既にインストールしている場合は不要です
```

## Motivation

TypeScript を使って Data-Driven な開発を進めていく場合、型定義の自動化は重要な課題です。JavaScript の実装がスキーマなどによってルール付けされていたとしても、型定義にそれが適用されていなければ開発者は型定義を更新するために余計な雑務を続けなくてはいけません。型定義はスキーマによって自動化され、開発者が行う変更を最低限にするべきです。そうすればその分の工数を他の問題解決に割くことが可能になります。

## Existing Approaches

それを実現するための方法として、2つの方法があります。今後の説明を簡潔にするため、名前をつけます。
- **Acrobat Type Resolution**
  - Mapped Type や Conditional Type などの発展的な型を組み合わせて型解決を介することで必要な型をつくる方法
- **AST Code Generation**
  - TypeScript Compiler API を使って Abstract Syntax Tree を操りコード生成をする方法

しかし、これらを実現するには多くの痛みが伴います。その痛みについて説明する前に、型定義を自動化する上で必要なステップを紹介します。

1. **収集**
    - 元となるデータから必要な値を収集する。
1. **変形**
    - 収集した値を次の構築に必要なかたちに変形する。
    - 不要なデータを取り除いたりする場合もここで行う。
1. **構築**
    - 変形したデータを元に型を構築する。

### **Acrobat Type Resolution**
さて、まずは **Acrobat Type Resolution** を使った場合のペインについて説明していきます。<br>
この方法では基本的にすべてのステップで痛みが伴います。小規模な自動化であればセットアップや管理も現実的な運用の範囲内ですが、複雑さが増したりすると途端に難易度が跳ね上がります。<br>
まず、**収集**のステップでは必要な値を String Literal などの Literal Type のかたちで収集する必要があります。これには `as const` や関数の型推論を使う必要があります。

`as const` を使う方法
```ts
const val = [
  { id: 'foo', type: 'text' },
  { id: 'bar', type: 'count' },
] as const;
type Val = typeof val[number]; // { readolny id: 'foo'; readolny type: 'text' } | { readolny id: 'bar'; readolny type: 'count' }
```
`as const` は一見良い方法に見えるかもしれませんが、これはスキーマの宣言時に型チェックを受けられないため、開発者への負担を増やしてしまいます。

関数の型推論を使う方法（参考として載せていますが、これを理解する必要はありません。）
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
関数の型推論を使う方法はセットアップが難しく、複雑度によっては機能しない場合もあります。

**Acrobat Type Resolution** を使う場合は**変形**と**構築**を同時に行うケースが多いでしょう。このステップでは多くの Mapped Type や Conditional Type をつかうことになり、単純に可読性が落ちてしまいます。また、あまりにも複雑な処理を加えようとすると型解決が追いつかずに機能しなくなってしまう場合もあります。

**Acrobat Type Resolution** における**構築**ステップについてはもう一つ問題があります。解決後の型の内容を GitHub などのリモートリポジトリで確認することができない点です。それを確認するにはエディタ上でマウスカーソルをホバーするなどの手順を踏む必要があります。

### **AST Code Generation**
つづいて、**AST Code Generation** におけるペインを説明していきます。<br>
この方法では**収集**や**変形**のステップに対してのペインはほぼ無いと言えます。集める値は実際の値ですし、変形も JavaScript として実行可能なコードで書くことができます。そもそも、AST やコード生成が関わってくるのは**構築**ステップのみであり、この2つのステップにおいてはただの **JavaScript で実行可能なコード**に過ぎません。デバッグやテストなども容易にできるでしょう。<br>
そのかわり、**構築**ステップには TypeScript Compiler API の学習コストというペインがあります。これはかなり重いコストで、実際にプロダクトを開発しながら導入するのはかなり厳しいでしょう。

このことを踏まえると **Acrobat Type Resolution** の**構築**ステップは **AST Code Generation** に比べてコストが低いと言えるかもしれません。なぜなら、**Acrobat Type Resolution** の**構築**ステップで必要な知識は他の幅広い場面で役に立つ可能性があるからです。

### `typeshot`
ここまでに説明した2つの方法はどちらも大きな問題を抱えていますが、それぞれのステップ毎に見てみるとあまり問題の無さそうな部分もあるようです。<br>
**収集**や**変形**は **JavaScript で実行可能なコード**で書けば楽です。<br>
**構築**ステップについては**型解決**が適しています。**変形**ステップで十分な処理を加えていれば Mapped Type の使い方といくつかのビルトイン型を使うだけでも十分に必要な型を構築することができるでしょう。

もしこの2つの方法を組み合わせていいとこ取りをできたとしたら、型定義の自動化を簡単に導入できるのではないでしょうか。それを実現するために作られたのが `typeshot` です。

## Get Started

`typeshot` を用いてコード生成を行う際の大まかな流れは以下のようになります。
1. **設計**
    - 必要な型や値を設計する。
1. **型パラメータファクトリの作成**
    - JavaScript上の値を型パラメータとして扱うための関数を用意する。
1. **元データの作成**
    - 生成に必要な値を用意する。
1. **型定義の収集**
    - 型と型パラメータの情報を `typeshot` に渡し、トークンオブジェクトを受け取る。
1. **コード生成**
    - トークンオブジェクトを使いつつ、文字列ベースでコード生成を行う。

※ 用語の混同を防ぐため、型引数のことを型パラメータと呼んでいます。

ここでは、細かい動作の背景などは省略しつつ `typeshot` の使い方について説明していきます。理解を簡単にするために、まずは**コード生成**の部分から説明をしていきます。

### **コード生成**
基本的に `typeshot` は受け取った文字列をそのままファイルへ出力します。文字列の入力は `styled-components` や `graphql-tag` などで用いられるようなタグ付きテンプレート文字列で行います。そのため、シンタックスハイライトこそないものの、概ね実際のコードを書くのと同じようにコード生成を実現できます。AST（Abstract Syntax Tree - 抽象構文木）についての知識は必要ありません。

```ts
typeshot.print`
const sample = { foo: 'foo', bar: 'bar' };
`;
```
```ts
const sample = { foo: 'foo', bar: 'bar' };
```

タグ付きテンプレート文字列をつかっているため、以下のように動的なコード生成も可能です。
```ts
const keys = ['foo', 'bar'];
typeshot.print`
const sample = { ${keys.map((key) => `${key}: '${key}'`).join(', ')} };
`;
```
```ts
const sample = { foo: 'foo', bar: 'bar' };
```

しかし、これだけでは文字列として書く以外の方法で型定義を生成することはできません。そこで `typeshot` は `typeshot.createType` を用いて型定義の情報を収集することを可能にしました。

### **型定義の収集**
このセクションではこのコードを見ながら説明を進めていきます。
```ts
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
この例からは以下のコードが出力されます。
```ts
export type ResultAlias = { foo: string; bar: number };
export interface ResultAlias {
  foo: string;
  bar: number;
}
let val: { foo: string; bar: number };
```
`createType` は2つの型パラメータと1つの引数を受け取ります。このセクションではまず静的な型生成について説明するため、注目するのは1つ目の型パラメータのみですが、他のものについても軽く役割を説明してしまいます。

1つ目の型パラメータには生成に使いたい型（今回は `Expand<Input>`）を入れます。<br>
2つ目の型パラメータには動的な型生成のソースとなる値が満たすべき型を入れます。<br>
引数には動的な型生成のための型パラメータファクトリの配列を渡します。<br>

`typeshot` は型システム上の情報とコード実行時の値とを静的解析によって結びつけています。この結びつきは、その値が型を満たしているというわけではなく、その値は型の情報を識別するものであるということ意味しています。この結びつきと、型を出力するときの表示形式を保持しているオブジェクトのことを `typeshot` では**型トークン**と呼んでいます。`createType` は型トークンそのものではなく、型トークンを作る関数を返します。この関数から型トークンを作るには2段階の呼び出しが必要になります。1段階目は動的な型生成のソースとなる値を渡すため、2段階目は出力時の型定義の形式を指定するための段階になります。

```ts
typeshot.print`
  export ${input({}).alias('ResultAlias')};
  export ${input({}).interface('ResultInterface')};
  let val: ${input({}).literal()};
`;
```
1段階目で渡す値は `createType` の2つ目の型パラメータで指定した型を満たしている必要がありますが、今回は静的な型生成なので空のオブジェクトを渡しています。

2段階目では、「`alias`(型エイリアス)」「`interface`(インターフェイス)」「`literal`(型リテラル)」の3つから出力形式を指定することができます。特に `literal` をサポートしていることは自由度の高いコード生成を実現するために必要不可欠です。この例のように変数の型に直接出力することを始めとした多くの場面で役立つはずです。`literal` は名前を持たないため引数は必要ありませんが、`alias` や `interface` を使うには引数に名前を渡す必要があります。

```ts
type Expand<T> = { [K in keyof T]: T[K] };

interface Input {
  foo: string;
  bar: number;
}
const input = typeshot.createType<Expand<Input>, {}>([]);
```

さて、今回の例では `Expand` という Generic Type を使っています。これは一見何もしない型のように見えますが、「インターフェイス」として定義されている `Input` を `{ foo: string; bar: number }` のかたちで出力するために必要なことをしています。もし `Expand` なしで `Input` だけをつかった場合は以下のような結果になります。
```ts
export type ResultAlias = Input;
export interface ResultAlias extends Input {}
let val: Input;
```
これは `typeshot` を使う上で重要なことなので少しだけ動作の背景を交えつつ説明します。<br>
TypeScript をサポートしているテキストエディタを使っていれば、マウスカーソルのホバーなどによって該当する型エイリアスなどの中身を詳細に見ることができるはずです。`typeshot` はエディタがこれらの表示をするためにしている処理と同じことをしています。しかし、インターフェイスに関してはその名前しか確認できないため、`Expand` を使ってインターフェイスを型リテラルとしての認識に変える必要があるのです。他にも交差型（Intersection Type）などの見た目を整えるためにもこの `Expand` は有用です。

### **元データの作成**
**元データの作成**についてはその名前の通りです。次に説明する型パラメータファクトリにあわせて値を用意してください。

### **型パラメータファクトリの作成**
このセクションでは、先程省略していた動的な型生成について以下のコードを見ながら説明を進めていきます。
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
少し複雑になってきました。順番に説明していきますが、先にこのコードの場合の結果を見てみましょう。
```ts
export interface Result {
  foo: string;
  bar: number;
}
```
さて、このコードで一番重要なのは `Construct` という Generic Type です。
```ts
type Construct<T extends Entry> = {
  [K in T['id']]: ValueMap[Extract<T, { id: K }>['type']];
};

interface ValueMap {
  text: string;
  count: number;
}
```
これは型パラメータで受け取ったエントリーを元にオブジェクトの型を作成します。この例では最終的に `{ id: 'foo'; type: 'text' } | { id: 'bar'; type: 'count' }` を `Construct` に渡すことになるので、その前提でこの型の動作を見ていきましょう。
1. `T['id']` は `'foo' | 'bar'` になります。
1. `Extract<T, { id: K }>` は、 `K` が `'foo'` のとき、元の Union Type を `{ id: 'foo'; type: 'text' }` に絞り込みます。
1. そのため、`Extract<T, { id: K }>['type']` は `{ id: 'foo'; type: 'text' }['type']` 、つまり `'text'` となります。
1. そして、`ValueMap[Extract<T, { id: K }>['type']]` が `ValueMap['text']` となるため、これは `string` 型となります。
1. `K` が `'bar'` の場合も同様に処理し、`number` 型になります。
1. 最終的に上記の `Result` のような型が作られます。

次に、`createParameter` について説明します。
```ts
const param = typeshot.createParameter<Entry, Entry[]>((entries) => {
  return typeshot.union(entries);
});
```
この関数は型パラメータの中身を決める役割を持っています。 `createType` と同様に2つの型パラメータを受け取ります。<br>
1つ目の型パラメータが作りたい型パラメータが継承すべき型、対象の型パラメータ（今回は `Construct` の `T`）が `extends` している型を入れてください。<br>
2つ目の型パラメータはファクトリの引数に使いたい型を入れてください。この型は `createType` の2つ目の型パラメータと揃っている必要があります。

`typeshot.union` は受け取った値を Union Type として定義することを指定するためのものです。ここでは、配列である `Entry[]` を受け取り、配列ではない `Entry` を継承した Union Type として定義しています。<br>
他には Intersection Type のための `typeshot.intersection`、そしてどちらでもない単体の型を表すための `typeshot.solo` があります。<br>
また、`createParameter` に渡した関数の中では値に対して何らかのフィルターをかけたり、変形を加えることができます。今回の例ではとくにそういった操作は加えていませんが、たとえば `Entry` に `required` のようなプロパティを追加して、ファクトリの中で `requied` が `true` であるものだけを残すようにフィルターをかければ、該当するエントリーだけを含むように生成することが可能になります。

先のセクションでは省略していた、`createType` の動的な型生成に関する部分について説明します。
```ts
const construct = typeshot.createType<Construct<typeshot.T>, Entry[]>([param]);
```
`createParameter` が型パラメータの中身を決める役割を持っている一方で、`createType` は型パラメータの位置を指定する役割を持っています。`typeshot` は1つ目の型パラメータに与えられた型の型パラメータの中に含まれている `typeshot.T` を探し出して、渡されたファクトリで作られた型で置き換えていきます。例えば、`Pick<Construct<typeshot.T>, typeshot.T>` のように複数の `typeshot.T` がある場合はネストの深さに関係なく左から順に置き換えられていきます。

```ts
const entries: Entry[] = [
  { id: 'foo', type: 'text' },
  { id: 'bar', type: 'count' },
];

typeshot.print`
  export ${construct(entries).interface('Result')}
`;
```

`construct` には動的な型生成のソースとなる値である `entries` を渡しています。これで、`typeshot` が内部的に `Construct<{ id: 'foo'; type: 'text' } | { id: 'bar'; type: 'count' }>` という型を作り、評価します。
ここまで来れば、前のセクションでも説明したように出力の形式を指定しすれば動的な型生成の生成を行うことができます。

### **設計**
ここまで説明してきたことを踏まえて、`Construct` や `Entry` のような型を設計してください。

