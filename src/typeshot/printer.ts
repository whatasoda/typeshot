import { getContext } from '../program/context';
import { reduceTaggedTemplate } from '../utils/tagged-template';
import { SourceTrace } from './source-trace';
import { isTypeInstance, TypeInstance } from './type-instance';

export type PrinterSubtitution = string | number | boolean | undefined | null | TypeInstance;
export type PrinterTemplate = (string | TypeInstance | SourceTrace)[];

const stringifySubstitution = (substitution: PrinterSubtitution): PrinterTemplate[number] => {
  if (isTypeInstance(substitution)) {
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
