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
  export type CreateTypeFragment = <_>(deps: FragmentDependencies) => Readonly<Fragment>;
  export type Fragment = Record<symbol, FragmentDependencies>;
  export type FragmentDependencies = Record<string, any>;
  export type FragmentInfo = CodeStack;

  export interface TypeDefinitionInfo {
    id: string;
    stack: CodeStack;
    fragments: Map<string, FragmentInfo>;
  }
  export type TypeDefinitionFactory<T extends object> = (props: T, createTypeFragment: CreateTypeFragment) => any;
  export type RegisterTypeDefinition = {
    <T extends object>(factory: TypeDefinitionFactory<T>): (props: T) => TypeInstanceFactory;
  };

  export interface TypeInstanceFactory {
    alias(name: string): TypeInstance;
    interface(name: string): TypeInstance;
    literal(): TypeInstance;
  }
  export type TypeInstance =
    | TypeInstanceObject<'alias'>
    | TypeInstanceObject<'interface'>
    | TypeInstanceObject<'literal'>;
  export class TypeInstanceObject<T extends 'alias' | 'interface' | 'literal'> {
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
  const instanceNextIdMap = new Map<string, number>();

  export const registerTypeDefinition: RegisterTypeDefinition = withStackTracking(
    <T extends object>(definitionStack: CodeStack, factory: TypeDefinitionFactory<T>) => {
      const context = getContext();
      const definitionId = `definition@${definitionStack.composed}`;
      const definitionInfo: TypeDefinitionInfo = {
        id: definitionId,
        stack: definitionStack,
        fragments: new Map(),
      };
      context.definitionInfoMap.set(definitionId, definitionInfo);

      return (props: T): TypeInstanceFactory => {
        const { fragments } = definitionInfo;
        const createTypeFragment: CreateTypeFragment = withStackTracking(
          (fragmentStack, dependencies): Fragment => {
            // TODO: put some comment
            const fragmentId = `fragment@${fragmentStack.composed}`;
            if (!fragments.has(fragmentId)) {
              fragments.set(fragmentId, fragmentStack);
            }

            return Object.assign(Object.create(null), { [Symbol(fragmentId)]: dependencies });
          },
        );

        const payload = factory(props, createTypeFragment);
        const common = [definitionId, payload] as const;

        return {
          alias: (name) => new TypeInstanceObject(...common, name, 'alias'),
          interface: (name) => new TypeInstanceObject(...common, name, 'interface'),
          literal: () => new TypeInstanceObject(...common, 'NO_NAME', 'literal'),
        };
      };
    },
  );

  /* Printer */
  export type TemplateSubtitutionsArray = (string | number | boolean | undefined | null | TypeInstance)[];
  export type ResolvedTemplateArray = (string | TypeInstance)[];

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
      if (substitution instanceof TypeInstanceObject) {
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
