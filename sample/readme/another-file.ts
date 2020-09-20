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
