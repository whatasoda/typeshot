import ts from 'typescript';
import { getCurrentContext, TypeshotContext } from './context';
import { injectTypeParameters, applyNamesToTypeNode } from './injector';
import { TypeInformation } from './program/decls';
import { evaluateTaggedTemplate, flattenTaggedTemplate } from './tagged-template';

const ASTFactories = ts;
type ASTFactories = typeof ts;
const assertContext: (context: TypeshotContext | null) => asserts context is TypeshotContext = (context) => {
  if (!context) throw new Error('Missing context! You cannot run typeshot globals without typeshot program.');
};

namespace typeshot {
  export type T = any; // dynamic type parameter
  export type Expand<T> = { [K in keyof T]: T[K] };

  export type TemplateSymbols = typeof TemplateSymbols[keyof typeof TemplateSymbols];
  export namespace TemplateSymbols {
    export const NAME = Symbol('typeshot:NAME');
    export const CONTENT = Symbol('typeshot:CONTENT');
    export const DECLARATION = Symbol('typeshot:DECLARATION');
  }

  export type PrimitiveValue = number | string | boolean | undefined | null;
  export type PrimitiveParameter = PrimitiveValue | PrimitiveValue[] | Record<string, PrimitiveValue>;
  export interface Config {
    output?: string;
  }

  export type StaticWriter = (template: string[], ...substitutions: StaticSubtitution[]) => void;
  export type StaticSubtitution = string | TemplateSymbols;

  export type TypeParameter = PrimitiveParameter[] | ts.TypeNode;
  export type SingleParameterFactory<P> = (props: P, ts: ASTFactories) => TypeParameter;
  export type MultipleParameterFactory<P> = (props: P, ts: ASTFactories) => TypeParameter[];

  export type NameDescriptor = string | Record<string, string> | string[];
  export type NameFactory<P> = (props: P) => NameDescriptor;

  export type DynamicSubtitution<P> = StaticSubtitution | ((props: P) => StaticSubtitution | DynamicSubtitution<P>[]);
  export type DynamicWriter<P> = (
    template: TemplateStringsArray,
    ...substitutions: DynamicSubtitution<P>[]
  ) => (props: P) => void;

  export const takeStatic = <_>(key: string, name: string) => (
    rawTemplate: TemplateStringsArray,
    ...rawSubstitutions: TemplateSymbols[]
  ) => {
    const context = getCurrentContext();
    assertContext(context);

    const entryKey = `static:${key}`;
    const info = context.types[entryKey];
    if (!info) {
      // eslint-disable-next-line no-console
      console.warn(`No correspond static type entry for '${entryKey}' found.`);
      return;
    }

    const [template, substitutions] = evaluateTaggedTemplate({}, rawTemplate, rawSubstitutions);
    context.entries.push({ ...info, name, template, substitutions });
  };

  export const createDynamic = <_>(key: string) => {
    const context = getCurrentContext();
    assertContext(context);

    key = `dynamic:${key}`;
    const info = context.types[key];
    if (!info) {
      // eslint-disable-next-line no-console
      console.warn(`No correspond dynamic type entry for '${key}' found.`);
      return { parameters: () => ({ names: () => () => () => {} }) };
    }

    return {
      parameters: <P = {}>(parameterFactory: MultipleParameterFactory<P> | SingleParameterFactory<P>[]) => ({
        names: (nameFactory: NameFactory<P>): DynamicWriter<P> => {
          let count = 0;
          return (rawTemplate, ...rawSubstitutions) => (props) => {
            submitDynamic(count++, context, info, props, parameterFactory, nameFactory, rawTemplate, rawSubstitutions);
          };
        },
      }),
    };
  };

  export const createPrameter = <P, T extends PrimitiveParameter>(factory: (props: P) => T[]) => factory;
  export const createTemplate = <P>(
    rawTemplate: TemplateStringsArray,
    ...rawSubstitutions: DynamicSubtitution<P>[]
  ) => {
    return flattenTaggedTemplate(rawTemplate, rawSubstitutions);
  };

  export const configuration = (config: Config): ((...args: Parameters<typeof String.raw>) => void) => {
    const context = getCurrentContext();
    assertContext(context);

    context.config = context.config || config;
    return (...args) => {
      context.header = context.header || String.raw(...args);
    };
  };
}

const submitDynamic = <P>(
  count: number,
  context: TypeshotContext,
  info: TypeInformation,
  props: P,
  parameterFactory: typeshot.MultipleParameterFactory<P> | typeshot.SingleParameterFactory<P>[],
  nameFactory: typeshot.NameFactory<P>,
  rawTemplate: TemplateStringsArray,
  rawSubstitutions: typeshot.DynamicSubtitution<P>[],
) => {
  const parameters = Array.isArray(parameterFactory)
    ? parameterFactory.map((factory) => factory(props, ASTFactories))
    : parameterFactory(props, ASTFactories);
  const names = nameFactory(props);

  const [template, substitutions] = evaluateTaggedTemplate(props, rawTemplate, rawSubstitutions);

  const injected = injectTypeParameters(parameters, info.type);
  const entryKey = `${info.key}-${count}`;
  if (info.type === injected) {
    // eslint-disable-next-line no-console
    console.warn(`Nothing injected to '${entryKey}'.`);
  }

  applyNamesToTypeNode(names, injected).forEach(([name, type]) => {
    context.entries.push({ key: `${entryKey}-${name}`, type, name, template, substitutions });
  });
};

(typeshot as any).default = typeshot;
export = typeshot;
