import { reduceTaggedTemplate } from '../tagged-template';

describe('reduceTaggedTemplate', () => {
  it('reduces substitution elements by concatenating with template', () => {
    const raw = ['foo', 'bar', 'baz'];
    const foo = Symbol('foo');
    const bar = Symbol('foo');

    const acc: string[] = [];
    {
      let i = 0;
      const stringify = jest.fn((s: symbol) => (++i % 2 ? `${i}` : s));
      const result = reduceTaggedTemplate(acc, Object.assign(raw, { raw }), [foo, bar], stringify);
      expect(result).toBe(acc);
      expect(result).toEqual(['foo1bar', bar, 'baz']);
      expect(stringify).toHaveBeenNthCalledWith(1, foo);
      expect(stringify).toHaveBeenNthCalledWith(2, bar);
    }

    {
      const stringify = jest.fn(() => '');
      const prev = [...acc];
      const result = reduceTaggedTemplate(acc, [], [], stringify);
      expect(result).toBe(acc);
      expect(result).toEqual(prev);
      expect(stringify).not.toBeCalled();
    }
  });
});
