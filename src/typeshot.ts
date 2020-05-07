import ts from 'typescript';
import { getCurrentContext, TypeshotContext } from './context';
import { injectTypeParameters, applyNamesToTypeNode } from './injector';

const ASTFactories = ts;
type ASTFactories = typeof ts;
const assertContext: (context: TypeshotContext | null) => asserts context is TypeshotContext = (context) => {
  if (!context) throw new Error('Missing context! You cannot run typeshot globals without typeshot program.');
};

namespace typeshot {
  export type T = any; // dynamic type parameter

  export type TemplateSymbols = typeof TemplateSymbols[keyof typeof TemplateSymbols];
  export namespace TemplateSymbols {
    export const NAME = Symbol('typeshot:NAME');
    export const CONTENT = Symbol('typeshot:CONTENT');
    export const DECLARATION = Symbol('typeshot:DECLARATION');
  }

  export type NameDescriptor = string | Record<string, string> | string[];
  export type TypeParameter = PrimitiveParameter | PrimitiveParameter[] | ts.TypeNode;
  export type PrimitiveParameter = number | string | boolean | undefined | null;
  export interface Config {
    output?: string;
  }

  export type StaticWriter = (template: string[], ...substitutions: StaticSubtitution[]) => void;
  export type StaticSubtitution = TemplateSymbols;

  export type ParamFactory<P> = (props: P, ts: ASTFactories) => readonly [NameDescriptor, TypeParameter[]];
  export type DynamicSubtitution<P> = ((props: P) => string) | TemplateSymbols;
  export type DynamicWriter<P> = (
    template: TemplateStringsArray,
    ...substitutions: DynamicSubtitution<P>[]
  ) => (props: P) => void;

  export const snapshot = <_>(key: string, name: string) => (
    template: TemplateStringsArray,
    ...substitutions: TemplateSymbols[]
  ) => {
    const context = getCurrentContext();
    assertContext(context);

    const entry = context.types[`static:${key}`];
    if (!entry) {
      // eslint-disable-next-line no-console
      console.warn(`No correspond static type entry for '${key}' found.`);
      return;
    }

    context.entries.push({ ...entry, name, template: [...template], substitutions });
  };

  export const dynamic = <_>(key: string) => {
    const context = getCurrentContext();
    assertContext(context);

    if (context.mode === 'post') {
      // eslint-disable-next-line no-console
      console.warn("Something wrong happened! 'typeshot.dynamic' should be removed in relay file.");
      return { parameters: () => () => () => {} };
    }

    const entry = context.types[`dynamic:${key}`];
    if (!entry) {
      // eslint-disable-next-line no-console
      console.warn(`No correspond dynamic type entry for '${key}' found.`);
      return { parameters: () => () => () => {} };
    }

    type ParametersType = <P = {}>(factory: ParamFactory<P>) => DynamicWriter<P>;
    const parameters: ParametersType = (factory) => (rawTemplate, ...rawSubstitutions) => (props) => {
      const [names, params] = factory(props, ASTFactories);

      const template: string[] = [rawTemplate[0]];
      const substitutions: TemplateSymbols[] = [];
      rawSubstitutions.forEach((curr, idx) => {
        if (
          typeof curr === 'symbol' &&
          (curr === TemplateSymbols.NAME || curr === TemplateSymbols.CONTENT || curr === TemplateSymbols.DECLARATION)
        ) {
          substitutions.push(curr);
          template.push(rawTemplate[idx + 1]);
          return;
        }

        if (typeof curr === 'function') template[substitutions.length] += curr(props);
        template[substitutions.length] += rawTemplate[idx + 1];
      });

      const injected = injectTypeParameters(params, entry.type);
      key = `dynamic:${key}-${context.dynamicEntryCount++}`;
      if (entry.type === injected) {
        // eslint-disable-next-line no-console
        console.warn(`Nothing injected to '${key}'.`);
      }

      applyNamesToTypeNode(names, injected).forEach(([name, type]) => {
        context.entries.push({ key: `${key}-${name}`, type, name, template, substitutions });
      });
    };

    return { parameters };
  };

  export const configuration = (config: Config): ((...args: Parameters<typeof String.raw>) => void) => {
    const context = getCurrentContext();
    assertContext(context);

    if (context.mode === 'post') {
      // eslint-disable-next-line no-console
      console.warn("Something wrong happened! 'typeshot.configuration' should be removed in relay file.");
      return () => {};
    }

    context.config = context.config || config;
    return (...args) => {
      context.header = context.header || String.raw(...args);
    };
  };
}

export = typeshot;
