export interface CodeStack {
  composed: string;
  filename: string;
  line: number;
  col: number;
}

const parseStack = (stack: string = '', depth: number): CodeStack => {
  if (!stack) throw new Error('Invalid Stack Information: make sure to run with node');
  stack = stack.replace(/^Error:\s+\n/, '');
  for (let i = depth; stack && i > 0; i--) {
    stack = stack.slice(stack.indexOf('\n') + 1);
  }
  stack = stack.replace(/^\s+at\s.+\((.+)\)$/m, '$1');

  if (!stack) throw new Error('Invalid Stack Information: invalid depth');
  const tailingNewLineIndex = stack.indexOf('\n');
  const composed = tailingNewLineIndex === -1 ? stack : stack.slice(0, tailingNewLineIndex);
  const [filename, line, col] = composed.split(':');

  return { composed, filename, line: ~~line, col: ~~col };
};

const getCachedStack = (stack: string = '', depth: number, cacheStore: Map<string, CodeStack>) => {
  const result = parseStack(stack, depth);
  const cached = cacheStore.get(result.composed);
  return cached || result;
};

export const withStackTracking = <T, U extends any[]>(func: (stack: CodeStack, ...args: U) => T) => {
  const cacheStore = new Map<string, CodeStack>();
  return (...args: U) => func(getCachedStack(new Error().stack, 1, cacheStore), ...args);
};
