import ts from 'typescript';

export const forEachChildDeep = (root: ts.Node, callback: (node: ts.Node) => void) => {
  const queue: ts.Node[] = [root];
  while (queue.length) {
    const node = queue.shift()!;
    callback(node);
    node.forEachChild((child) => void queue.push(child));
  }
};
