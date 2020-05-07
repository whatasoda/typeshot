import type ts from 'typescript';
import type prettier from 'prettier';
import type { TemplateSymbols } from '../typeshot';

export interface ProgramConfig {
  test: RegExp;
  project?: string;
  basePath?: string;
  prettierOptions?: prettier.Options;
}

export interface TypeInformation {
  type: ts.TypeNode;
  key: string;
}

export interface TypeshotEntry extends TypeInformation {
  name: string;
  template: string[];
  substitutions: TemplateSymbols[];
}
