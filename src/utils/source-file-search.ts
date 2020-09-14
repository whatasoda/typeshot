import ts from 'typescript';
import type { CodeStack } from './stack-tracking';

export const getNodeByStack = <T extends ts.Node = ts.Node>(
  stack: CodeStack,
  getSourceFile: (filename: string) => ts.SourceFile | null,
  filterAncestors?: (node: ts.Node) => node is T,
) => {
  if (!stack) throw new Error('Invalid Stack Information: make sure to run with node');

  const { filename, line, col } = stack;
  const source = getSourceFile(filename);
  if (!source) throw new Error('Source File Not Found: check tsconfig or typeshot options');

  const lines = source.getLineStarts();
  if (line >= lines.length) throw new Error('Unexpected Line Information: something wrong happened');

  const pos = lines[line] + col;
  let layer: readonly ts.Node[] = source.statements;
  const ancestors: T[] = [];
  while (layer.length) {
    for (let i = 0, length = layer.length; i < length; i++) {
      const node = layer[i];
      if (pos === node.pos) {
        if (!filterAncestors || filterAncestors(node)) {
          ancestors.push(node as T);
        }
        return { node, ancestors };
      }

      const nextNode: ts.Node | undefined = layer[i + 1];
      if (!nextNode || pos < nextNode.pos) {
        if (!filterAncestors || filterAncestors(node)) {
          ancestors.push(node as T);
        }
        layer = node.getChildren();
      }
    }
  }
  throw new Error('Node Not Found: something wrong happened');
};
