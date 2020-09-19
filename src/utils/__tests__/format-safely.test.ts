import { formatSafely } from '../format-safely';

const validCode = `
const foo = { bar : 'baz'
} ;
`;

const invalidCode = `
const foo = { bar: 'baz'; };
`;

describe('formatSafely', () => {
  it('works correctly', () => {
    expect(formatSafely(validCode, process.cwd(), undefined)).toBe(`const foo = { bar: 'baz' };\n`);
    expect(formatSafely(validCode, process.cwd(), '.prettierrc')).toBe(`const foo = { bar: 'baz' };\n`);
    expect(formatSafely(validCode, process.cwd(), { parser: 'typescript' })).toBe(`const foo = { bar: "baz" };\n`);
    expect(formatSafely(validCode, process.cwd(), '.prettierrc.js')).toBe(validCode);
    expect(formatSafely(invalidCode, process.cwd(), undefined)).toBe(invalidCode);
  });
});
