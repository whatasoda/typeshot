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
    p                  | basePath      | expected                    | maybeModule
    ${'typescript'}    | ${'/foo/bar'} | ${'typescript'}             | ${true}
    ${'typescript'}    | ${'/foo/bar'} | ${'/foo/bar/typescript'}    | ${false}
    ${'typescript.ts'} | ${'/foo/bar'} | ${'typescript.ts'}          | ${true}
    ${'typescript.ts'} | ${'/foo/bar'} | ${'/foo/bar/typescript.ts'} | ${false}
    ${'/baz/qux.ts'}   | ${'/foo/bar'} | ${'/baz/qux.ts'}            | ${false}
    ${'./baz/qux.ts'}  | ${'/foo/bar'} | ${'/foo/bar/baz/qux.ts'}    | ${false}
    ${'../baz/qux.ts'} | ${'/foo/bar'} | ${'/foo/baz/qux.ts'}        | ${false}
  `("returns '$expected' if received ('$p', '$basePath')", (data) => {
    const { p, basePath, expected, maybeModule } = data as {
      expected: string;
      p: string;
      basePath: string;
      maybeModule: boolean;
    };
    expect(ensureAbsolutePath(p, basePath, maybeModule)).toBe(expected);
  });
});
