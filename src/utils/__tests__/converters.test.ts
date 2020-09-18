import { ensureAbsolutePath, getDirectoryLessPath, getSymbolName } from '../converters';

describe('getSymbolName', () => {
  it('works correctly', () => {
    expect(getSymbolName(Symbol('test'))).toBe('test');
    expect(getSymbolName(Symbol.for('test'))).toBe('test');
  });
});

describe('getDirectoryLessPath', () => {
  it.each`
    p                                          | basePath      | expected
    ${'/foo/bar/./.././__foo__bar__/..baz.ts'} | ${'/foo/bar'} | ${'_....__foo__bar__.--baz.ts'}
    ${'/foo/bar/./.././__foo__bar__/..baz.ts'} | ${'/foo'}     | ${'_.__foo__bar__.--baz.ts'}
  `("returns '$expected' if received ('$p', '$basePath')", (data: any) => {
    const { p, basePath, expected } = data as { expected: string; p: string; basePath: string };
    expect(getDirectoryLessPath(p, basePath)).toBe(expected);
  });
});

describe('ensureAbsolutePath', () => {
  it.each`
    p                  | basePath      | expected
    ${'typescript'}    | ${'/foo/bar'} | ${'typescript'}
    ${'typescript.ts'} | ${'/foo/bar'} | ${'typescript.ts'}
    ${'/baz/qux.ts'}   | ${'/foo/bar'} | ${'/baz/qux.ts'}
    ${'./baz/qux.ts'}  | ${'/foo/bar'} | ${'/foo/bar/baz/qux.ts'}
    ${'../baz/qux.ts'} | ${'/foo/bar'} | ${'/foo/baz/qux.ts'}
  `("returns '$expected' if received ('$p', '$basePath')", (data) => {
    const { p, basePath, expected } = data as { expected: string; p: string; basePath: string };
    expect(ensureAbsolutePath(p, basePath)).toBe(expected);
  });
});
