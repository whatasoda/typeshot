import { getCurrentContext } from './context';
import { CodeStack, withStackTracking } from './utils/stack-tracking';

export type TypeFragmentStacks = Record<string, CodeStack>;
export type TypeFragment = Record<symbol, TypeDependencies>;
export type TypeDependencies = Record<string, any>;
export type CreateTypeFragment = <_>(deps: TypeDependencies) => Readonly<TypeFragment>;

export interface TypeDefinition {
  id: string;
  stack: CodeStack;
  fragmentStacks: TypeFragmentStacks;
}
export type TypeDefinitionFactory<T extends object> = (props: T, createTypeFragment: CreateTypeFragment) => any;
export type RegisterTypeDefinition = {
  <T extends object>(factory: TypeDefinitionFactory<T>): (props: T) => TypeTokenFactory;
};

export interface TypeTokenFactory {
  alias(name: string): TypeToken;
  interface(name: string): TypeToken;
  literal(): TypeToken;
}
export type TypeToken = TypeTokenObject<'alias'> | TypeTokenObject<'interface'> | TypeTokenObject<'literal'>;
export class TypeTokenObject<T extends 'alias' | 'interface' | 'literal'> {
  constructor(
    public readonly definitionId: string,
    public readonly payload: any,
    public readonly name: string,
    public readonly format: T,
  ) {}
}

export const registerTypeDefinition: RegisterTypeDefinition = withStackTracking(
  <T extends object>(definitionStack: CodeStack, factory: TypeDefinitionFactory<T>) => {
    const context = getCurrentContext();
    const definitionId = `definition@${definitionStack.composed}`;
    const definition: TypeDefinition = {
      id: definitionId,
      stack: definitionStack,
      fragmentStacks: Object.create(null),
    };
    context.definitions.set(definitionId, definition);

    return (props: T) => {
      const { fragmentStacks } = definition;
      const createTypeFragment: CreateTypeFragment = withStackTracking(
        (fragmentStack, dependencies): TypeFragment => {
          // TODO: put some comment
          const fragmentId = `fragment@${fragmentStack.composed}`;
          const fragmentSymbol = Symbol(fragmentId);
          fragmentStacks[fragmentId] = fragmentStack;

          const fragment: TypeFragment = Object.create(null);
          return Object.freeze(Object.assign(fragment, { [fragmentSymbol]: dependencies }));
        },
      );

      const payload = factory(props, createTypeFragment);
      const common = [definitionId, payload] as const;

      return {
        alias: (name) => new TypeTokenObject(...common, name, 'alias'),
        interface: (name) => new TypeTokenObject(...common, name, 'interface'),
        literal: () => new TypeTokenObject(...common, 'NO_NAME', 'literal'),
      };
    };
  },
);
