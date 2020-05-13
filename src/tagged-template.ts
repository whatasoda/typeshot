import type { DynamicSubtitution, TemplateSymbols } from './typeshot';

export const flattenTaggedTemplate = <P>(
  [head, ...template]: TemplateStringsArray,
  substitutions: DynamicSubtitution<P>[],
) => {
  const flatTemplate: DynamicSubtitution<P>[] = [head];
  substitutions.forEach((substitution, i) => {
    flatTemplate.push(substitution, template[i]);
  });

  return flatTemplate;
};

export const evaluateTaggedTemplate = <P>(
  props: P,
  rawTemplate: TemplateStringsArray,
  rawSubstitutions: DynamicSubtitution<P>[],
) => {
  const strings: string[] = [''];
  const symbols: TemplateSymbols[] = [];

  const stack: DynamicSubtitution<P>[][] = [flattenTaggedTemplate(rawTemplate, rawSubstitutions)];
  let pointer = 0;

  while (stack.length) {
    const layer = stack[0];
    if (!layer.length) {
      stack.shift();
      continue;
    }

    let curr = layer.shift()!;
    if (typeof curr === 'function') {
      const value = curr(props);
      if (Array.isArray(value)) {
        stack.unshift(value);
        continue;
      } else {
        curr = value;
      }
    }

    if (typeof curr === 'string') {
      strings[pointer] += curr;
    } else if (typeof curr === 'symbol') {
      symbols.push(curr);
      strings[++pointer] = '';
    }
  }

  return [strings, symbols] as const;
};
