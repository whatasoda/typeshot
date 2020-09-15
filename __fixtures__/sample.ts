import typeshot from 'typeshot';

interface TypeMap {
  text: string;
  number: number;
}

interface FieldDefinition {
  id: string;
  type: keyof TypeMap;
  required: string;
}

const PropsType = typeshot.registerTypeDefinition((fields: FieldDefinition[], makeType) => {
  const acc = {};
  const resolvedIdSet = new Set<string>();

  fields.forEach(({ id, type, required }) => {
    if (resolvedIdSet.has(id)) throw new Error('A duplicated field id found!');
    Object.assign(
      acc,
      required
        ? makeType<{ [K in typeof id]-?: TypeMap[typeof type] }>({ id, type })
        : makeType<{ [K in typeof id]+?: TypeMap[typeof type] }>({ id, type }),
    );
  });

  return acc;
});

PropsType([]);
