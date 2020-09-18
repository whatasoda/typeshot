import ts from 'typescript';
import { getFixtures } from '../../../test-utils/getFixtures';
import { AstTemplate } from '../ast-template';

const fixtrue = getFixtures('sample', true);

describe('AstTemplate', () => {
  class TestTemplate extends AstTemplate<string, []> {
    protected getSubstitution(node: ts.Node) {
      const text = node.getText();
      if (text === 'number') {
        return 'NUMBER';
      } else if (text === "'number'") {
        return "'NUMBER'";
      } else {
        return null;
      }
    }
    protected serializeSubstitution(substitution: string) {
      return substitution;
    }
  }

  const sourceText = fixtrue.getFullText();
  const setUp = () => {
    const t = new TestTemplate(fixtrue, sourceText);
    const { template, substitutions }: { template: TemplateStringsArray; substitutions: string[] } = t as any;
    const expectedBase = String.raw(template, ...substitutions);
    return { t, template, substitutions, expectedBase };
  };

  it('should create template successfully', () => {
    const { t, template, substitutions, expectedBase } = setUp();

    expect(`'${template.join(`',\n${'-'.repeat(10)}\n'`)}'`).toMatchSnapshot();
    expect(substitutions).toMatchSnapshot();
    expect(t.serialize()).toBe(expectedBase);
  });

  it('should serialize successfully', () => {
    const { t, expectedBase } = setUp();
    expect(t.serialize()).toBe(expectedBase);
  });

  it('should wrap template with received strings', () => {
    const { t, expectedBase } = setUp();
    t.wrap('---', '---');
    expect(t.serialize()).toBe(`---${expectedBase}---`);
  });

  it('should append templates', () => {
    const acc = new TestTemplate(null);
    const { t, expectedBase } = setUp();
    acc.append([t, t], '~~~').append([t], '@@@');
    expect(acc.serialize()).toBe(`${expectedBase}~~~${expectedBase}@@@${expectedBase}`);
  });

  it('throws error if trying to append to non-accumulator instance', () => {
    const { t } = setUp();
    expect(() => t.append([t], '')).toThrowError();
  });

  test('ensureEnd works correctly', () => {
    const { t, expectedBase } = setUp();
    t.ensureEnd('###');
    expect(t.serialize()).toBe(`${expectedBase}###`);
    t.ensureEnd('###');
    expect(t.serialize()).toBe(`${expectedBase}###`);
  });

  test('freeze prevents every operation except serialize', () => {
    const t = new TestTemplate(null);
    t.freeze();
    t.wrap('abcdefg', 'hijklmn');
    t.ensureEnd('opqrstu');
    t.append([t]);
    expect(t.serialize()).toBe('');
  });
});
