interface CodeStack {
  composed: string;
  filename: string;
  line: number;
  col: number;
}

const parseStack = (stack: string = '', depth: number): CodeStack | null => {
  if (!stack) return null;
  stack = stack.replace(/^Error:\s+\n/, '');
  for (let i = depth; stack && i > 0; i--) {
    stack = stack.slice(stack.indexOf('\n') + 1);
  }
  stack = stack.replace(/^\s+at\s.+\((.+)\)$/m, '$1');

  if (!stack) null;
  const tailingNewLineIndex = stack.indexOf('\n');
  const composed = tailingNewLineIndex === -1 ? stack : stack.slice(0, tailingNewLineIndex);
  const [filename, line, col] = composed.split(':');

  return { composed, filename, line: ~~line, col: ~~col };
};

export const withStackTracking = <T, U extends any[]>(func: (stack: CodeStack | null, ...args: U) => T) => {
  return (...args: U) => func(parseStack(new Error().stack, 1), ...args);
};
