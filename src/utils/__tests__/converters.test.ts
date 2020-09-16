import { getDirectoryLessPath, getSymbolName } from '../converters';

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
  `("returns '$expected' if received '$p', '$basePath'", (data: any) => {
    const { p, basePath, expected } = data as { expected: string; p: string; basePath: string };
    expect(getDirectoryLessPath(p, basePath)).toBe(expected);
  });
});
