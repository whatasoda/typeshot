import type ts from 'typescript';
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

  const lines = sourceFile.getLineStarts();
  if (line >= lines.length) throw new Error('Unexpected Line Information: something wrong happened');

  const pos = lines[line - 1] + col - 1;
  return getNodeByPosition(pos, sourceFile, filterPath);
};

export const getNodeByPosition = <T extends ts.Node = ts.Node>(
  pos: number,
  sourceFile: ts.SourceFile,
  filterPath?: (node: ts.Node) => node is T,
) => {
  const { statements } = sourceFile;
  if (statements[0].parent !== sourceFile) throw new Error('Make sure to turn setParentNodes true');

  let layer: readonly ts.Node[] = statements;
  const nodePath: T[] = [];
  while (layer.length) {
    LAYER_LOOP: for (let i = 0, length = layer.length; i < length; i++) {
      const node = layer[i];
      if (pos === node.getStart()) {
        if (!filterPath || filterPath(node)) {
          nodePath.push(node as T);
        }
        return { node, nodePath, sourceFile };
      }

      const nextNode: ts.Node | undefined = layer[i + 1];
      if (!nextNode || pos < nextNode.getStart()) {
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

export const forEachChildDeep = (root: ts.Node, callback: (node: ts.Node) => true | void) => {
  const stack: ts.Node[] = [root];
  while (stack.length) {
    const node = stack.shift()!;
    if (callback(node) === true) {
      continue; // skip children
    } else {
      stack.unshift(...node.getChildren());
    }
  }
};
