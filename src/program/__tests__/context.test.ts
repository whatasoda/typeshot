import path from 'path';
import { getContext, runWithContext } from '../context';

const log = jest.spyOn(console, 'log');

describe('getContext', () => {
  it('throws error if calling directly', () => {
    expect(() => getContext()).toThrowError();
  });
});

describe('runWithContext', () => {
  const testModulePath = path.resolve(__dirname, '../../../test-utils/context-test.ts');

  it('works correctly', async () => {
    const context = { test: jest.fn() };
    const result = await runWithContext(testModulePath, context as any);
    expect(result).toBe(context);
    expect(log).toBeCalledWith('test error');
  });

  it('throws error if calling twice in same context', async () => {
    await expect(() => runWithContext(testModulePath, {} as any)).rejects.toThrowError();
  });
});
