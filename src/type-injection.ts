import ts from 'typescript';
import type { Typeshot, TypeParameter } from './typeshot';

export const injectTypeParameters = (
  { ParameterKind }: Typeshot,
  params: TypeParameter[],
  type: ts.TypeNode,
): ts.TypeNode => {
  const createPrimitiveTypeNode = createPrimitiveTypeNodeFactory();
  const paramNodes = params.map<ts.TypeNode>((param) => {
    if (param instanceof ParameterKind.Solo) {
      return createPrimitiveTypeNode(param.param);
    }

    if (param instanceof ParameterKind.Union) {
      if (!param.param.length) return ts.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
      return ts.createUnionTypeNode(param.param.map(createPrimitiveTypeNode));
    }

    if (param instanceof ParameterKind.Intersection) {
      if (!param.param.length) return ts.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
      return ts.createIntersectionTypeNode(param.param.map(createPrimitiveTypeNode));
    }

    if (ts.isTypeNode(param)) {
      return param;
    }

    return ts.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
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

export const createPrimitiveTypeNodeFactory = (maxDepth: number = 10) => {
  const factory = (value: any, depth: number): ts.TypeNode => {
    if (value === null) return ts.createNull();
    if (value === undefined) return ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword);
    if (typeof value === 'boolean') return ts.createLiteralTypeNode(ts.createLiteral(value));
    if (typeof value === 'string') return ts.createLiteralTypeNode(ts.createStringLiteral(value));
    if (typeof value === 'number') return ts.createLiteralTypeNode(ts.createNumericLiteral(`${value}`));
    if (typeof value === 'object' && depth <= maxDepth) {
      return Array.isArray(value)
        ? ts.createTupleTypeNode(value.map((v) => factory(v, depth + 1)))
        : ts.createTypeLiteralNode(Object.entries(value).map((e) => createMember(e, depth + 1)));
    }
    return ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  };

  const createMember = ([k, v]: [string, any], depth: number) => {
    return ts.createPropertySignature(undefined, k, undefined, factory(v, depth), undefined);
  };

  return (value: any) => factory(value, 0);
};
