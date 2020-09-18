import ts from 'typescript';
import { getFixtures } from '../../../test-utils/getFixtures';
import { forEachChildDeep, getNodeByStack, getSourceFileByStack } from '../ast';
import { CodeStack } from '../stack-tracking';

const fixtrue = getFixtures('sample', true);

const stack = (line: number, col: number): CodeStack => ({
  composed: `${fixtrue.fileName}:${line}:${col}`,
  filename: fixtrue.fileName,
  line,
  col,
});

describe('getSourceFileByStack', () => {
  const testStack: CodeStack = { filename: 'testFileName', col: 0, line: 0, composed: 'testFileName:0:0' };
  it('works correctly', () => {
    const getSourceFile = jest.fn(() => fixtrue);
    const result = getSourceFileByStack(testStack, getSourceFile);

    expect(result).toBe(fixtrue);
    expect(getSourceFile).toBeCalledWith('testFileName');
  });

  it('throws error if source file is not found', () => {
    expect(() => getSourceFileByStack(testStack, () => null)).toThrowError();
  });
});

describe('getNodeByStack', () => {
  it('returns node and nodePath according to stack information', () => {
    const { node, nodePath, sourceFile } = getNodeByStack(stack(20, 28), fixtrue);
    expect(node.getText()).toBe('registerTypeDefinition');
    expect(nodePath[nodePath.length - 1]).toBe(node);
    expect(sourceFile).toBe(fixtrue);
  });

  it('filters nodePath if filterPath is specified', () => {
    const { node, nodePath, sourceFile } = getNodeByStack(stack(20, 28), fixtrue, ts.isCallExpression);
    expect(node.getText()).toBe('registerTypeDefinition');
    expect(sourceFile).toBe(fixtrue);

    const nearest = nodePath[nodePath.length - 1];
    expect(nearest).not.toBe(node);
    expect('\n' + nearest.getText() + '\n').toBe(`
typeshot.registerTypeDefinition((fields: FieldDefinition[], makeType) => {
  const acc = {};
  const resolvedIdSet = new Set<string>();

  fields.forEach(({ id, type, required }) => {
    if (resolvedIdSet.has(id)) throw new Error('Duplicated field id found!');

    const t = required
      ? makeType<{ [K in typeof id]-?: TypeMap[typeof type] } & string[]>({ id, type })
      : makeType<{ [K in typeof id]+?: TypeMap[typeof type] } & string[]>({ id, type });
    Object.assign(acc, t);
  });
  const aaa = 'aaa';
  (acc as any).aaa = makeType<number | typeof aaa>({ aaa });

  return acc;
})
`);
  });

  it('throws error if file name is not matched', () => {
    expect(() => {
      getNodeByStack({ col: 0, line: 0, filename: 'test', composed: 'test' }, fixtrue);
    }).toThrowError();
  });

  it('throws error if source file is not created with setParentNodes true', () => {
    const altFixture = getFixtures('sample', false);
    expect(() => {
      getNodeByStack(stack(20, 28), altFixture);
    }).toThrowError();
  });

  it('throws error if stack is not matched with source file', () => {
    expect(() => getNodeByStack(stack(1000, 10), fixtrue)).toThrowError();
    expect(() => getNodeByStack(stack(20, 29), fixtrue)).toThrowError();
  });
});

describe('forEachChildDeep', () => {
  it('works correctly', () => {
    const acc: string[] = [];
    forEachChildDeep(fixtrue.statements[2], (node) => {
      acc.push(node.getFullText());
    });
    expect(acc.join('\n' + '-'.repeat(20) + '\n')).toMatchSnapshot();
  });
  it('works correctly with returning true', () => {
    const acc: string[] = [];
    const root = fixtrue.getChildren()[0];
    forEachChildDeep(root, (node) => {
      if (node === root) return;
      acc.push(node.getFullText());
      return true;
    });
    expect(acc.join('\n' + '-'.repeat(20) + '\n')).toMatchSnapshot();
  });
});
