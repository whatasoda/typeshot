import type ts from 'typescript';
import type { TemplateSymbols } from '../typeshot';

export interface TypeInformation {
  type: ts.TypeNode;
  key: string;
}

export interface TypeshotEntry extends TypeInformation {
  name: string;
  template: string[];
  substitutions: TemplateSymbols[];
}
