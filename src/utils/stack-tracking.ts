export interface CodeStack {
  composed: string;
  filename: string;
  line: number;
  col: number;
}

const parseStack = (stack: string, depth: number): CodeStack => {
  if (!stack) throw new Error('Invalid Stack Information: make sure to run with node');
  let cursor = 0;
  for (let i = depth + 1; stack && i > 0; i--) {
    cursor = stack.indexOf('\n', cursor) + 1;
  }
  // Ignore the case if the stack doesn't include any new line
  const composed = stack
    .slice(cursor + /* '____at_' ('_'=' ') */ 7, stack.indexOf('\n', cursor))
    .replace(STACK_PARENTHESES, '');

  if (!stack) throw new Error('Invalid Stack Information: invalid depth');
  const [filename, line, col] = composed.split(':');
  return { composed, filename, line: ~~line, col: ~~col };
};
const STACK_PARENTHESES = /(^.+\(|\)$)/g;

const target = Object.create(null) as { stack: string };
const cacheStore = new Map<string, CodeStack>();
export const withStackTracking = <T, U extends any[]>(func: (stack: CodeStack, ...args: U) => T) => {
  return (...args: U) => {
    Error.stackTraceLimit = 2;
    Error.captureStackTrace(target);
    Error.stackTraceLimit = 10;
    return func(cacheStore.get(target.stack) || parseStack(target.stack, 1), ...args);
  };
};
