import ts from 'typescript';
import { createTypeNodeFromPrimitiveParameter } from './program/ast-utils';
import typeshot, { TypeParameter } from './typeshot';

export const injectTypeParameters = (params: TypeParameter[], type: ts.TypeNode): ts.TypeNode => {
  const paramNodes = params.map<ts.TypeNode>((param) => {
    if (Array.isArray(param)) {
      return ts.createUnionTypeNode(param.map(createTypeNodeFromPrimitiveParameter));
    } else if (typeof param === 'object' && param && ts.isTypeNode(param)) {
      return param;
    } else {
      return createTypeNodeFromPrimitiveParameter(param);
    }
  });

  const stack: [number, ts.TypeNode][] = [[-1, type]];
  const flatTree: [number, ts.TypeNode][] = [];
  while (stack.length) {
    const curr = stack.pop()!;
    const parantIdx = flatTree.push(curr) - 1;
    const [, node] = curr;

    if (ts.isTypeReferenceNode(node) && node.typeArguments) {
      const tmp = node.typeArguments.map<[number, ts.TypeNode]>((arg) => [parantIdx, arg]);
      stack.push(...tmp.reverse());
    }
  }

  let pointer = paramNodes.length - 1;
  const updateStack: number[] = [];
  const updateFlattenTree = (parentIdx: number, idx: number, node: ts.TypeNode) => {
    flatTree[idx][1] = node;
    if (updateStack.length === 0 || updateStack[updateStack.length - 1] < parentIdx) {
      updateStack.push(parentIdx);
    }
  };

  for (let idx = flatTree.length - 1; idx >= 0; idx--) {
    const [parentIdx, curr] = flatTree[idx];
    if (!ts.isTypeReferenceNode(curr)) continue;

    if (curr.typeName.getText() === 'typeshot.T') {
      if (pointer !== -1) updateFlattenTree(parentIdx, idx, paramNodes[pointer--]);
    } else if (updateStack[updateStack.length - 1] === idx) {
      updateStack.pop();
      const typeArguments: ts.TypeNode[] = [];
      for (let j = idx + 1; j < flatTree.length; j++) {
        const [parentIdx, node] = flatTree[j];
        if (parentIdx === idx) typeArguments.push(node);
        else if (parentIdx < idx) break;
      }

      updateFlattenTree(
        parentIdx,
        idx,
        ts.updateTypeReferenceNode(curr, curr.typeName, ts.createNodeArray(typeArguments)),
      );
    }
  }

  return flatTree[0][1];
};

export const applyNamesToTypeNode = (name: typeshot.NameDescriptor, type: ts.TypeNode): [string, ts.TypeNode][] => {
  if (typeof name === 'string') {
    return [[name, type]];
  } else if (typeof name === 'object' && name) {
    const numKey = Array.isArray(name);
    return Object.entries(name).map(([key, name]) => {
      const keyNode = ts.createLiteralTypeNode(ts[numKey ? 'createNumericLiteral' : 'createStringLiteral'](key));
      return [name, ts.createIndexedAccessTypeNode(type, keyNode)];
    });
  }
  return [];
};
