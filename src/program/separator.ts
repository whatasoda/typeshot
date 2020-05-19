const START = /^\s*?\/\/ typeshot-start ?.*?$/m;
const END = /^\s*?\/\/ typeshot-end ?.*?$/m;

export const getGenerationRange = (fullText: string) => {
  const start = fullText.match(START);
  const end = fullText.match(END);

  return [
    start && typeof start.index !== 'undefined' ? start.index + start[0].length : 0,
    end && typeof end.index !== 'undefined' ? end.index - 1 : fullText.length,
  ] as const;
};
