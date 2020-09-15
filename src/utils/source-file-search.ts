import ts from 'typescript';
import type { CodeStack } from './stack-tracking';

export const getSourceFileByStack = (stack: CodeStack, getSourceFile: (filename: string) => ts.SourceFile | null) => {
  const { filename } = stack;
  const sourceFile = getSourceFile(filename);
  if (sourceFile) {
    return sourceFile;
  } else {
    throw new Error('Source File Not Found: check tsconfig or typeshot options');
  }
};

export const getNodeByStack = <T extends ts.Node = ts.Node>(
  stack: CodeStack,
  sourceFile: ts.SourceFile,
  filterAncestors?: (node: ts.Node) => node is T,
) => {
  const { filename, line, col } = stack;
  if (filename !== sourceFile.fileName) throw new Error('Invalid Source File: filename unmatched');

  const lines = sourceFile.getLineStarts();
  if (line >= lines.length) throw new Error('Unexpected Line Information: something wrong happened');

  const pos = lines[line] + col;
  let layer: readonly ts.Node[] = sourceFile.statements;
  const nodePath: T[] = [];
  while (layer.length) {
    for (let i = 0, length = layer.length; i < length; i++) {
      const node = layer[i];
      if (pos === node.pos) {
        if (!filterAncestors || filterAncestors(node)) {
          nodePath.push(node as T);
        }
        return { node, nodePath, sourceFile };
      }

      const nextNode: ts.Node | undefined = layer[i + 1];
      if (!nextNode || pos < nextNode.pos) {
        if (!filterAncestors || filterAncestors(node)) {
          nodePath.push(node as T);
        }
        layer = node.getChildren();
      }
    }
  }
  throw new Error('Node Not Found: something wrong happened');
};
