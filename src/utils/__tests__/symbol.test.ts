import { getSymbolName } from '../symbol';

describe('getSymbolName', () => {
  it('works correctly', () => {
    expect(getSymbolName(Symbol('test'))).toBe('test');
    expect(getSymbolName(Symbol.for('test'))).toBe('test');
  });
});
