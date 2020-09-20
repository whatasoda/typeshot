export const reduceTaggedTemplate = <T, U>(
  acc: (string | T)[],
  templateArray: TemplateStringsArray | readonly string[],
  substitutions: (Exclude<U, any[]> | (string | T)[])[],
  stringify: (substitution: Exclude<U, any[]>) => string | T,
) => {
  if (!templateArray.length) return acc;
  let cursor = acc.length;
  acc[cursor] = templateArray[0];
  for (let i = 0, length = substitutions.length; i < length; i++) {
    const curr = substitutions[i];
    if (Array.isArray(curr)) {
      cursor = acc.push(...curr);
      acc[cursor] = '';
    } else {
      const substitution = stringify(curr);
      if (typeof substitution === 'string') {
        acc[cursor] += substitution;
      } else {
        acc[++cursor] = substitution;
        acc[++cursor] = '';
      }
    }
    acc[cursor] += templateArray[i + 1];
  }
  return acc;
};
