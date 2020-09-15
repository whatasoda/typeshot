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
  filterPath?: (node: ts.Node) => node is T,
) => {
  const { filename, line, col } = stack;
  if (filename !== sourceFile.fileName) throw new Error('Invalid Source File: filename unmatched');

  const { statements } = sourceFile;
  if (statements[0].parent !== sourceFile) throw new Error('Make sure to turn setParentNodes true');

  const lines = sourceFile.getLineStarts();
  if (line >= lines.length) throw new Error('Unexpected Line Information: something wrong happened');

  const pos = lines[line - 1] + col - 1;
  let layer: readonly ts.Node[] = statements;
  const nodePath: T[] = [];
  while (layer.length) {
    LAYER_LOOP: for (let i = 0, length = layer.length; i < length; i++) {
      const node = layer[i];
      if (pos === node.pos) {
        if (!filterPath || filterPath(node)) {
          nodePath.push(node as T);
        }
        return { node, nodePath, sourceFile };
      }

      const nextNode: ts.Node | undefined = layer[i + 1];
      if (!nextNode || pos < nextNode.pos) {
        if (!filterPath || filterPath(node)) {
          nodePath.push(node as T);
        }
        layer = node.getChildren();
        break LAYER_LOOP;
      }
    }
  }
  throw new Error('Node Not Found: something wrong happened');
};