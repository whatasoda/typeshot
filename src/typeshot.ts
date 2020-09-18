import { getContext } from './context';
import { SourceTrace } from './program/resolve-source-trace';
import type { TypeDefinitionInfo } from './program/type-definition';
import { reduceTaggedTemplate } from './tagged-template';
import { CodeStack, withStackTracking } from './utils/stack-tracking';

namespace typeshot {
  export type Typeshot = typeof typeshot;
  export type Integrate<T> = { [K in keyof T]: T[K] };

  export const union = <T>(members: T[]) => new TypeKind.Union<T>(members);
  export namespace TypeKind {
    export class Union<T = any> {
      constructor(public readonly members: T[]) {}
    }
  }

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export type CreateTypeFragment = <_>(deps: FragmentDependencies) => Readonly<Fragment>;
  export type Fragment = Record<symbol, FragmentDependencies>;
  export type FragmentDependencies = Record<string, any>;
  export type TypeDefinitionFactory<T extends object> = (props: T, createTypeFragment: CreateTypeFragment) => any;
  type RegisterTypeDefinition = {
    <T extends object>(factory: TypeDefinitionFactory<T>): (props: T) => TypeInstanceFactory;
  };
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
  export type PrinterSubtitution = string | number | boolean | undefined | null | TypeInstance;
  export type PrinterTemplate = (string | TypeInstance | SourceTrace)[];
  const stringifySubstitution = (substitution: PrinterSubtitution): PrinterTemplate[number] => {
    if (substitution instanceof TypeInstanceObject) {
      return substitution;
    } else {
      return typeof substitution === 'string' ? substitution : String(substitution);
    }
  };

  export const print = (templateArray: TemplateStringsArray, ...substitutions: PrinterSubtitution[]): void => {
    const context = getContext();
    reduceTaggedTemplate(context.template, templateArray, substitutions, stringifySubstitution);
  };

  export const template = (templateArray: TemplateStringsArray, ...substitutions: PrinterSubtitution[]) => {
    return reduceTaggedTemplate([], templateArray, substitutions, stringifySubstitution);
  };

  /* Source Trace */
  export type TraceBreakTemplate = (string | (() => string))[];
  const emptyTemplateStrings: TemplateStringsArray = Object.assign([], { raw: [] });
  export const openTrace = withStackTracking(
    (stack, template: TemplateStringsArray = emptyTemplateStrings, ...substitutions: TraceBreakTemplate) => {
      const context = getContext();
      if (context.pendingTrace) throw new Error('Make sure to close existing trace before opening another trace');

      const content = reduceTaggedTemplate([], template, substitutions, (s) => s);
      context.pendingTrace = { stack, content };
    },
  );

  export const closeTrace = withStackTracking(
    (stack, template: TemplateStringsArray = emptyTemplateStrings, ...substitutions: TraceBreakTemplate) => {
      const context = getContext();
      if (!context.pendingTrace) throw new Error(`Make sure to open trace before closing trace`);

      const content = reduceTaggedTemplate([], template, substitutions, (s) => s);
      context.template.push(new SourceTrace(context.pendingTrace, { stack, content }));
      context.pendingTrace = null;
    },
  );
}

export = typeshot;
