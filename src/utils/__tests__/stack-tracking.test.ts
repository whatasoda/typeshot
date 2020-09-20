import { parseStack, withStackTracking } from '../stack-tracking';

describe('withStackTracking', () => {
  it('works correctly', () => {
    const fn0 = jest.fn();
    const fn1 = jest.fn(() => {
      return withStackTracking(fn0);
    });
    const fn2 = jest.fn();
    const wrapped1 = withStackTracking(fn1);
    const wrapped0 = wrapped1();
    const wrapped2 = { fn: withStackTracking(fn2) };
    wrapped0();
    wrapped2.fn();

    expect(fn1).toBeCalledWith({
      composed: `${__filename}:11:22`,
      filename: __filename,
      line: 11,
      col: 22,
    });
    expect(fn0).toBeCalledWith({
      composed: `${__filename}:13:5`,
      filename: __filename,
      line: 13,
      col: 5,
    });
    expect(fn2).toBeCalledWith({
      composed: `${__filename}:14:14`,
      filename: __filename,
      line: 14,
      col: 14,
    });
  });
});

const stack0 = `Error:
    at /foo/bar/buz.js:12:34
    at /foo/bar/buz/qux.js:56:789`;

const stack1 = `Error:
    at Map.forEach (/foo/bar/buz.js:12:34)
    at Map.forEach (/foo/bar/buz/qux.js:56:789)`;

describe('parseStack', () => {
  it('parses stack text into CodeStack', () => {
    expect(parseStack(stack0, 0)).toEqual({
      composed: '/foo/bar/buz.js:12:34',
      filename: '/foo/bar/buz.js',
      line: 12,
      col: 34,
    });
    expect(parseStack(stack0, 1)).toEqual({
      composed: '/foo/bar/buz/qux.js:56:789',
      filename: '/foo/bar/buz/qux.js',
      line: 56,
      col: 789,
    });
    expect(parseStack(stack1, 0)).toEqual({
      composed: '/foo/bar/buz.js:12:34',
      filename: '/foo/bar/buz.js',
      line: 12,
      col: 34,
    });
    expect(parseStack(stack1, 1)).toEqual({
      composed: '/foo/bar/buz/qux.js:56:789',
      filename: '/foo/bar/buz/qux.js',
      line: 56,
      col: 789,
    });
  });

  it('uses deepest stack if received too much depth', () => {
    expect(parseStack(stack0, 2)).toEqual({
      composed: '/foo/bar/buz/qux.js:56:789',
      filename: '/foo/bar/buz/qux.js',
      line: 56,
      col: 789,
    });
    expect(parseStack(stack0, 100)).toEqual({
      composed: '/foo/bar/buz/qux.js:56:789',
      filename: '/foo/bar/buz/qux.js',
      line: 56,
      col: 789,
    });
    expect(parseStack(stack1, 2)).toEqual({
      composed: '/foo/bar/buz/qux.js:56:789',
      filename: '/foo/bar/buz/qux.js',
      line: 56,
      col: 789,
    });
    expect(parseStack(stack1, 100)).toEqual({
      composed: '/foo/bar/buz/qux.js:56:789',
      filename: '/foo/bar/buz/qux.js',
      line: 56,
      col: 789,
    });
  });
});
