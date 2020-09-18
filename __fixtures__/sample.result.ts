// GENERATED FILE -- DO NOT EDIT

interface TypeMap {
  text: string;
  number: number;
}

export interface FieldDefinition {
  id: string;
  type: keyof TypeMap;
  required: boolean;
}

export type Hoge = {
  foo?: number | undefined;
  bar: number;
  baz?: string | undefined;
  qux: string;
  aaa: number | 'aaa';
} & string[];

// hogehoge
