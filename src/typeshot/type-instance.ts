type TypeInstanceFormat = keyof TypeInstanceFactory;
export interface TypeInstanceFactory {
  alias(name: string): TypeInstance;
  interface(name: string): TypeInstance;
  literal(): TypeInstance;
}

export type TypeInstance = { [K in TypeInstanceFormat]: TypeInstanceObject<K> }[TypeInstanceFormat];

export type { TypeInstanceObject };
/** @private */
class TypeInstanceObject<T extends TypeInstanceFormat> {
  public readonly id: string;
  constructor(
    public readonly definitionId: string,
    public readonly value: any,
    public readonly name: string,
    public readonly format: T,
  ) {
    const ID = instanceNextIdMap.get(definitionId) || 0;
    this.id = `${ID}`;
    instanceNextIdMap.set(definitionId, ID + 1);
  }
}

export const isTypeInstance = (value: any): value is TypeInstance => value instanceof TypeInstanceObject;

const instanceNextIdMap = new Map<string, number>();

export const createTypeInstanceFactory = (definitionId: string, value: any) => ({
  alias: (name: string) => new TypeInstanceObject(definitionId, value, name, 'alias'),
  interface: (name: string) => new TypeInstanceObject(definitionId, value, name, 'interface'),
  literal: () => new TypeInstanceObject(definitionId, value, 'NO_NAME', 'literal'),
});
