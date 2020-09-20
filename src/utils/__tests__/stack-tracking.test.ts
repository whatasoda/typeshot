import { withStackTracking } from '../stack-tracking';

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
