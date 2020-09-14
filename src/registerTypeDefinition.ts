import { CodeStack, withStackTracking } from './utils/stack-tracking';

export type TypeFragment = Record<string, CodeStack>;
export type TypeFragments = Record<string, Readonly<TypeFragment>>;
export type CreateTypeFragment = <_>() => Readonly<TypeFragment>;

export type TypeDependencies = Record<string, any>;
export type RegisterDependencies = (deps: TypeDependencies) => void;

export type TypeDefinitionFactory<T extends object> = (
  props: T,
  createTypeFragment: CreateTypeFragment,
  registerDependencies: RegisterDependencies,
) => any;

export interface TypeDefinition {
  id: string;
  stack: CodeStack;
  fragments: TypeFragments;
}
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
    public readonly dependencies: TypeDependencies,
    public readonly payload: any,
    public readonly name: string,
    public readonly format: T,
  ) {}
}

export const registerTypeDefinition: RegisterTypeDefinition = withStackTracking(
  <T extends object>(definitionStack: CodeStack, factory: TypeDefinitionFactory<T>) => {
    const definitionId = `definition@${definitionStack.composed}`;

    const fragments: TypeFragments = Object.create(null);
    const createTypeFragment = withStackTracking(
      (fragmentStack): TypeFragment => {
        const fragmentId = `fragment@${fragmentStack.composed}`;
        if (fragmentId in fragments) {
          return fragments[fragmentId];
        } else {
          const fragment: TypeFragment = Object.create(null);
          fragment[fragmentId] = fragmentStack;
          return (fragments[fragmentId] = Object.freeze(fragment));
        }
      },
    );

    const definition: TypeDefinition = {
      id: definitionId,
      stack: definitionStack,
      fragments,
    };
    definition; // TODO: register definition to context

    return (props: T) => {
      // register props as basic dependencies
      const dependencies: TypeDependencies = Object.assign(Object.create(null), props);
      const registerDependencies = (deps: object) => {
        Object.entries(deps).forEach(([key, value]) => {
          if (key in dependencies) {
            console.warn(
              `Type Dependency Name Conflict: type dependency '${key}' has been overwritten (${definitionStack.composed})`,
            );
          }
          dependencies[key] = value;
        });
      };

      const payload = factory(props, createTypeFragment, registerDependencies);
      const common = [definitionId, dependencies, payload] as const;

      return {
        alias: (name) => new TypeTokenObject(...common, name, 'alias'),
        interface: (name) => new TypeTokenObject(...common, name, 'interface'),
        literal: () => new TypeTokenObject(...common, 'NO_NAME', 'literal'),
      };
    };
  },
);
