export const reduceTaggedTemplate = <T, U>(
  acc: (string | T)[],
  templateArray: TemplateStringsArray,
  substitutions: U[],
  stringify: (substitution: U) => string | T,
) => {
  if (!templateArray.length) return acc;
  let pointer = acc.length;
  acc[pointer] = templateArray[0];
  for (let i = 0, length = substitutions.length; i < length; i++) {
    const substitution = stringify(substitutions[i]);
    if (typeof substitution === 'string') {
      acc[pointer] += substitution;
    } else {
      acc[++pointer] = substitution;
      acc[++pointer] = '';
    }
    acc[pointer] += templateArray[i + 1];
  }
  return acc;
};
