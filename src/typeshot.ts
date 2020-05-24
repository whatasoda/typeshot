import ts from 'typescript';
import { getCurrentContext, TypeshotContext } from './context';
import { injectTypeParameters } from './type-injection';
import { evaluateTaggedTemplate } from './tagged-template';

const ASTFactories = ts;
type ASTFactories = typeof ts;
const assertContext: (context: TypeshotContext | null) => asserts context is TypeshotContext = (context) => {
  if (!context) throw new Error('Missing context! You cannot run typeshot globals without typeshot program.');
};

namespace typeshot {
  export type T = any; // dynamic type parameter

  export type Typeshot = typeof typeshot;
  /*
  
  Parameter
  
  */
  export type TypeParameter<T = any> =
    | ParameterKind.Solo<T>
    | ParameterKind.Union<T>
    | ParameterKind.Intersection<T>
    | ts.TypeNode;
  export type SingleParameterFactory<P> = (props: P, ts: ASTFactories) => TypeParameter;
  export type MultipleParameterFactory<P> = (props: P, ts: ASTFactories) => TypeParameter[];
  export type ParameterFactory<P> = MultipleParameterFactory<P> | SingleParameterFactory<P>[];

  export const solo = <T>(parameter: T) => new ParameterKind.Solo<T>(parameter);
  export const union = <T>(parameter: T[]) => new ParameterKind.Union<T>(parameter);
  export const intersection = <T>(parameter: T[]) => new ParameterKind.Intersection<T>(parameter);

  export namespace ParameterKind {
    export class Solo<T = any> {
      constructor(public readonly param: T) {}
    }
    export class Union<T = any> {
      constructor(public readonly param: T[]) {}
    }
    export class Intersection<T = any> {
      constructor(public readonly param: T[]) {}
    }
  }
  export const createPrameter = <T, P>(factory: (props: P, ts: ASTFactories) => TypeParameter<T>) => factory;

  /*
  
  Type
  
  */
  export type TypeToken = TokenObject<'alias'> | TokenObject<'interface'> | TokenObject<'literal'>;
  export class TokenObject<T extends 'alias' | 'interface' | 'literal'> {
    constructor(public readonly id: string, public readonly name: string, public readonly format: T) {}
  }
  export interface TypeTokenFactory<P> {
    alias(name: string, props: P, property?: string | number): TypeToken;
    interface(name: string, props: P, property?: string | number): TypeToken;
    literal(props: P, property?: string | number): TypeToken;
    named(name: string, property?: string | number): NamedTypeTokenFactory<P>;
    mapArray(names: string[]): NamedTypeTokenFactory<P>[];
    mapRecord<T extends string>(names: Record<T, string>): Record<T, NamedTypeTokenFactory<P>>;
  }
  export interface NamedTypeTokenFactory<P> {
    readonly name: string;
    alias(props: P): TokenObject<'alias'>;
    interface(props: P): TokenObject<'interface'>;
    literal(props: P): TokenObject<'literal'>;
  }

  const _createType = <_, P = {}>(parameterFactory: ParameterFactory<P>, rootId: string): TypeTokenFactory<P> => {
    const context = getCurrentContext();
    assertContext(context);

    const info = context.getType(rootId);
    if (!info) throw new Error(`No correspond dynamic type entry for '${rootId}' found.`);

    let count = 0;

    const createToken = <T extends TypeToken['format']>(
      format: T,
      name: string,
      props: P,
      property?: string | number,
    ): TokenObject<T> => {
      const parameters = Array.isArray(parameterFactory)
        ? parameterFactory.map((factory) => factory(props, ASTFactories))
        : parameterFactory(props, ASTFactories);

      const id = `${rootId}-${count++}`;
      const type = injectTypeParameters(typeshot, parameters, info.type);
      context.requests.push({ id, type, property });

      return new TokenObject(id, name, format);
    };

    const named = (name: string, property?: string | number): NamedTypeTokenFactory<P> => ({
      name,
      alias: (props) => createToken('alias', name, props, property),
      interface: (props) => createToken('interface', name, props, property),
      literal: (props) => createToken('literal', name, props, property),
    });

    return {
      alias: (...args) => createToken('alias', ...args),
      interface: (...args) => createToken('interface', ...args),
      literal: (...args) => createToken('literal', 'UNNAMED', ...args),
      named,
      mapArray: (names) => names.map(named),
      mapRecord: (names) => {
        return Object.keys(names).reduce<Record<string, NamedTypeTokenFactory<P>>>((acc, property) => {
          acc[property] = named(names[property as keyof typeof names], property);
          return acc;
        }, {});
      },
    };
  };
  // The rootId will auto matically injected.
  export const createType = _createType as <_, P = {}>(parameterFactory: ParameterFactory<P>) => TypeTokenFactory<P>;

  /*
  
  Printer
  
  */
  export type StaticSubtitution = string | number | boolean | undefined | null | TypeToken;
  export type FunctionSubstitution<P> = (props: P) => StaticSubtitution | DynamicSubtitution<P>[];
  export type DynamicSubtitution<P> = StaticSubtitution | FunctionSubstitution<P>;
  export type ResolvedTemplate = string | TypeToken;

  export const print = (template: TemplateStringsArray, ...substitutions: StaticSubtitution[]) => {
    const context = getCurrentContext();
    assertContext(context);
    evaluateTaggedTemplate(template, substitutions, null, context.template);
  };

  export const createPrinter = <P>(template: TemplateStringsArray, ...substitutions: DynamicSubtitution<P>[]) => {
    return (props: P) => {
      const context = getCurrentContext();
      assertContext(context);
      evaluateTaggedTemplate(template, substitutions, props, context.template);
    };
  };

  export const createTemplate = <P>(template: TemplateStringsArray, ...substitutions: DynamicSubtitution<P>[]) => {
    return evaluateTaggedTemplate(template, substitutions, null, []);
  };

  /*
  
  Config
  
  */
  export interface Config {
    output?: string;
  }
  export const config = (config: Config): ((...args: Parameters<typeof String.raw>) => void) => {
    const context = getCurrentContext();
    assertContext(context);

    context.config = context.config || config;
    return (...args) => {
      context.header = context.header || String.raw(...args);
    };
  };
}

export = typeshot;
