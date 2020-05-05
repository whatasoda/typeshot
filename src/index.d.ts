import ts from 'typescript';
import prettier from 'prettier';

export as namespace typeshot;
export = typeshot;
declare function typeshot<_>(key: string, name: string): typeshot.StaticWriter;

type ASTFactories = typeof import('typescript');

// eslint-disable-next-line no-redeclare
declare namespace typeshot {
  type Typeshot = typeof typeshot;
  type T = any; // dynamic type parameter
  function dynamic<_>(key: string): ParameterPhase;
  function configuration(config: Partial<Configuration>): (...args: Parameters<typeof String.raw>) => void;

  interface Configuration {
    output: string;
  }

  type TemplateSymbols = typeof TemplateSymbols[keyof typeof TemplateSymbols];
  namespace TemplateSymbols {
    type _self = typeof TemplateSymbols;
    const NAME: unique symbol;
    const CONTENT: unique symbol;
    const DECLARATION: unique symbol;
  }

  type NameDescriptor = string | Record<string, string> | string[];
  type TypeParameter = PrimitiveParameter | PrimitiveParameter[] | ts.TypeNode;
  type PrimitiveParameter = number | string | boolean | undefined | null;

  type StaticWriter = (template: TemplateStringsArray, ...substitutions: typeshot.TemplateSymbols[]) => void;

  interface ParameterPhase {
    parameters<P = {}>(
      factory: (props: P, ts: ASTFactories) => readonly [NameDescriptor, TypeParameter[]],
    ): DynamicWriter<P>;
  }
  type DynamicSubtitution<P> = ((props: P) => string) | typeshot.TemplateSymbols;
  type DynamicWriter<P> = (
    template: TemplateStringsArray,
    ...substitutions: DynamicSubtitution<P>[]
  ) => (props: P) => void;

  interface Config {
    test: RegExp;
    project?: string;
    basePath?: string;
    prettierOptions?: prettier.Options;
  }

  type TypeEntry = DefaultTypeEntry | DynamicTypeEntry;
  interface DefaultTypeEntry {
    mode: 'default';
    type: ts.TypeNode;
    key: string;
  }
  interface DynamicTypeEntry {
    mode: 'dynamic';
    type: ts.TypeNode;
    key: string;
  }

  type ValueEntry = DefaultEntry | DynamicEntry;

  interface DefaultEntry extends DefaultTypeEntry {
    mode: 'default';
    name: string;
    template: string[];
    substitutions: typeshot.TemplateSymbols[];
  }
  interface DynamicEntry extends DynamicTypeEntry {
    mode: 'dynamic';
    key: string;
    names: NameDescriptor;
    params: TypeParameter[];
    template: string[];
    substitutions: typeshot.TemplateSymbols[];
  }

  interface TypeEntryContainer {
    default: Record<string, DefaultTypeEntry>;
    dynamic: Record<string, DynamicTypeEntry>;
  }

  interface TemplateHost {
    typeEntries: TypeEntry[];
    valueEntries: ValueEntry[];
  }
}
