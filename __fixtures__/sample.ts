import typeshot from 'typeshot';

typeshot.openTrace`
// GENERATED FILE -- DO NOT EDIT
`;

interface TypeMap {
  text: string;
  number: number;
}

export interface FieldDefinition {
  id: string;
  type: keyof TypeMap;
  required: boolean;
}

typeshot.closeTrace();

const PropsType = typeshot.registerTypeDefinition((makeType, fields: FieldDefinition[]) => {
  const acc = {};
  const resolvedIdSet = new Set<string>();

  fields.forEach(({ id, type, required }) => {
    if (resolvedIdSet.has(id)) throw new Error('Duplicated field id found!');

    const t = required
      ? makeType<{ [K in typeof id]-?: TypeMap[typeof type] } & string[]>({ id, type })
      : makeType<{ [K in typeof id]+?: TypeMap[typeof type] } & string[]>({ id, type });
    Object.assign(acc, t);
  });
  const aaa = 'aaa';
  (acc as any).aaa = makeType<number | typeof aaa>({ aaa });

  return acc;
});

const Props = PropsType([
  { id: 'foo', type: 'number', required: false },
  { id: 'bar', type: 'number', required: true },
  { id: 'baz', type: 'text', required: false },
  { id: 'qux', type: 'text', required: true },
]);

typeshot.print`
  export type Hoge = ${Props.literal()}
`;

typeshot.openTrace();

// hogehoge
typeshot.closeTrace();
