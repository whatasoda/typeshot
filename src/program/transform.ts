export interface Replacement {
  end: number;
  text: string | ((raw: string) => string);
}

export const transformSourceText = (raw: string, replacements: Replacement[]) => {
  let pointer = 0;
  const results: string[] = [];
  replacements.forEach(({ end, text }, pos) => {
    if (pos < pointer) return;
    const next = typeof text === 'string' ? text : text(raw.slice(pos, end));
    results.push(raw.slice(pointer, pos), next);
    pointer = end;
  });
  results.push(raw.slice(pointer));

  return results.join('');
};
