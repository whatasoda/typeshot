import ts from 'typescript';
import path from 'path';

export const FIXTURE_DIR = path.resolve(__dirname, '../__fixtures__');

export const getFixtures = jest.fn((name: string, setParentNodes: boolean) => {
  const fileName = `${FIXTURE_DIR}/${name}.ts`;
  const sourceText = ts.sys.readFile(fileName);
  if (!sourceText) throw new Error(`fixture file '${name}' is not found`);
  return ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, setParentNodes, ts.ScriptKind.TS);
});
