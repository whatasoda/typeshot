import type { DynamicSubtitution, TypeToken, FunctionSubstitution, ResolvedTemplate } from './typeshot';

interface TaggedTemplateEvaluator {
  <P>(
    template: TemplateStringsArray,
    substitutions: DynamicSubtitution<P>[],
    props: P,
    acc: ResolvedTemplate[],
  ): ResolvedTemplate[];
  <P>(
    template: TemplateStringsArray,
    substitutions: DynamicSubtitution<P>[],
    props: null,
    acc: (ResolvedTemplate | FunctionSubstitution<P>)[],
  ): (ResolvedTemplate | FunctionSubstitution<P>)[];
  <P>(
    template: TemplateStringsArray,
    substitutions: DynamicSubtitution<P>[],
    props: P | null,
    acc: ResolvedTemplate[] | (ResolvedTemplate | FunctionSubstitution<P>)[],
  ): ResolvedTemplate[] | (ResolvedTemplate | FunctionSubstitution<P>)[];
}

export const evaluateTaggedTemplate: TaggedTemplateEvaluator = <P>(
  template: TemplateStringsArray,
  substitutions: DynamicSubtitution<P>[],
  props: P | null,
  acc: (ResolvedTemplate | FunctionSubstitution<P>)[] | TypeToken[],
): any[] => {
  let pointer = acc.length;
  acc[pointer] = '';

  let useTemplate = true;
  let i = -1;
  const stack: DynamicSubtitution<P>[][] = [];

  while (i < substitutions.length) {
    let curr: DynamicSubtitution<P>;

    if (stack.length) {
      const layer = stack[0];
      if (!layer.length) {
        stack.shift();
        continue;
      }
      curr = layer.shift();
    } else if (useTemplate) {
      curr = template[++i];
      useTemplate = false;
    } else {
      curr = substitutions[i];
      useTemplate = true;
    }

    if (typeof curr === 'function') {
      if (!props) {
        acc[++pointer] = curr;
        acc[++pointer] = '';
        continue;
      }

      const value = curr(props);
      if (Array.isArray(value)) {
        stack.unshift([...value]);
        continue;
      }

      curr = value;
    }

    if (typeof curr === 'string') {
      acc[pointer] += curr;
    } else if (typeof curr === 'object' && curr) {
      acc[++pointer] = curr;
      acc[++pointer] = '';
    } else {
      acc[pointer] += String(curr);
    }
  }

  return acc;
};
