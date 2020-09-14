import { withStackTracking } from '../stack-tracking';

describe('withStackTracking', () => {
  it('works correctly', () => {
    const base = jest.fn();
    const fn = withStackTracking(base);

    fn();
    expect(base).toBeCalledWith({
      composed: `${__filename}:8:5`,
      filename: __filename,
      line: 8,
      col: 5,
    });
  });
});
