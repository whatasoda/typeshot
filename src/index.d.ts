import ts from 'typescript';
import prettier from 'prettier';

declare global {
  function typeshot<_>(key: string, name: string): StaticWriter;
  namespace typeshot {
    type T = any; // dynamic type parameter
    function dynamic<_>(key: string): ParameterPhase;
    function configuration(config: Partial<Configuration>): (...args: Parameters<typeof String.raw>) => void;
    const TemplateSymbols: TemplateSymbols._self;
    type NameDescriptor = string | Record<string, string> | string[];
    type TypeParameter = typeshot.PrimitiveParameter | typeshot.PrimitiveParameter[] | ts.TypeNode;
    type PrimitiveParameter = number | string | boolean | undefined | null;
    interface Configuration {
      output: string;
    }
  }
}

type ASTFactories = typeof import('typescript');

export type Typeshot = typeof typeshot;

export type TemplateSymbols = typeof TemplateSymbols[keyof typeof TemplateSymbols];
export namespace TemplateSymbols {
  type _self = typeof TemplateSymbols;
  export const NAME: unique symbol;
  export const CONTENT: unique symbol;
  export const DECLARATION: unique symbol;
}

export type StaticWriter = (template: TemplateStringsArray, ...substitutions: TemplateSymbols[]) => void;

export interface ParameterPhase {
  parameters<P = {}>(
    factory: (props: P, ts: ASTFactories) => readonly [typeshot.NameDescriptor, typeshot.TypeParameter[]],
  ): DynamicWriter<P>;
}
export type DynamicSubtitution<P> = ((props: P) => string) | TemplateSymbols;
export type DynamicWriter<P> = (
  template: TemplateStringsArray,
  ...substitutions: DynamicSubtitution<P>[]
) => (props: P) => void;

export interface Config {
  test: RegExp;
  project?: string;
  basePath?: string;
  prettierOptions?: prettier.Options;
}

export type TypeEntry = DefaultTypeEntry | DynamicTypeEntry;
export interface DefaultTypeEntry {
  mode: 'default';
  type: ts.TypeNode;
  key: string;
}
export interface DynamicTypeEntry {
  mode: 'dynamic';
  type: ts.TypeNode;
  key: string;
}

export type ValueEntry = DefaultEntry | DynamicEntry;

export interface DefaultEntry extends DefaultTypeEntry {
  mode: 'default';
  name: string;
  template: string[];
  substitutions: TemplateSymbols[];
}
export interface DynamicEntry extends DynamicTypeEntry {
  mode: 'dynamic';
  key: string;
  names: typeshot.NameDescriptor;
  params: typeshot.TypeParameter[];
  template: string[];
  substitutions: TemplateSymbols[];
}

export interface TypeEntryContainer {
  default: Record<string, DefaultTypeEntry>;
  dynamic: Record<string, DynamicTypeEntry>;
}

export interface TemplateHost {
  typeEntries: TypeEntry[];
  valueEntries: ValueEntry[];
}
