import { getContext } from './context';
import { CodeStack, withStackTracking } from './utils/stack-tracking';

namespace typeshot {
  export type Typeshot = typeof typeshot;

  export const union = <T>(members: T[]) => new TypeKind.Union<T>(members);
  export namespace TypeKind {
    export class Union<T = any> {
      constructor(public readonly members: T[]) {}
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export type CreateTypeFragment = <_>(deps: TypeDependencies) => Readonly<TypeFragment>;
  export type TypeFragmentStacks = Record<string, CodeStack>;
  export type TypeFragment = Record<symbol, TypeDependencies>;
  export type TypeDependencies = Record<string, any>;

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
    public readonly id: string;
    constructor(
      public readonly definitionId: string,
      public readonly payload: any,
      public readonly name: string,
      public readonly format: T,
    ) {
      const ID = tokenNextIdMap.get(definitionId) || 0;
      this.id = `${ID}`;
      tokenNextIdMap.set(definitionId, ID + 1);
    }
  }
  const tokenNextIdMap = new Map<string, number>();

  export const registerTypeDefinition: RegisterTypeDefinition = withStackTracking(
    <T extends object>(definitionStack: CodeStack, factory: TypeDefinitionFactory<T>) => {
      const context = getContext();
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

  /* Printer */
  export type TemplateSubtitutionsArray = (string | number | boolean | undefined | null | TypeToken)[];
  export type ResolvedTemplateArray = (string | TypeToken)[];

  export const print = (templateArray: TemplateStringsArray, ...substitutions: TemplateSubtitutionsArray): void => {
    const context = getContext();
    reduceTaggedTemplate(context.template, templateArray, substitutions);
  };

  export const template = (
    templateArray: TemplateStringsArray,
    ...substitutions: TemplateSubtitutionsArray
  ): ResolvedTemplateArray => {
    return reduceTaggedTemplate([], templateArray, substitutions);
  };

  const reduceTaggedTemplate = (
    acc: ResolvedTemplateArray,
    templateArray: TemplateStringsArray,
    substitutions: TemplateSubtitutionsArray,
  ): ResolvedTemplateArray => {
    let pointer = acc.length;
    acc[pointer] = templateArray[0];
    for (let i = 0, length = substitutions.length; i < length; i++) {
      const substitution = substitutions[i];
      if (substitution instanceof TypeTokenObject) {
        acc[++pointer] = substitution;
        acc[++pointer] = '';
      } else {
        acc[pointer] += typeof substitution === 'string' ? substitution : String(substitution);
      }
      acc[pointer] += templateArray[i + 1];
    }
    return acc;
  };

  /* Config */
  export interface Config {
    output?: string;
  }
  export const config = (config: Config): ((...args: Parameters<typeof String.raw>) => void) => {
    const context = getContext();

    context.config = context.config || config;
    return (...args) => {
      context.header = context.header || String.raw(...args);
    };
  };
}

export = typeshot;
