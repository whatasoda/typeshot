import ts from 'typescript';

type CallLikeExpression = Exclude<
  ts.CallLikeExpression,
  ts.Decorator | ts.JsxOpeningElement | ts.JsxSelfClosingElement
>;

/**
 * Note that ts.Decorator, ts.JsxOpeningElement and ts.JsxSelfClosingElement are not included.
 */
export const flattenCallLikeExpressionChain = (entry: ts.Expression) => {
  const result: CallLikeExpression[] = [];

  let curr: ts.Expression | null = entry;
  while (curr) {
    if (ts.isTaggedTemplateExpression(curr)) {
      result.push(curr);
      curr = curr.tag;
      continue;
    }
    if (ts.isCallExpression(curr) || ts.isNewExpression(curr)) {
      result.push(curr);
      curr = curr.expression;
      continue;
    }

    if (ts.isPropertyAccessExpression(curr) || ts.isElementAccessExpression(curr)) {
      curr = curr.expression;
      continue;
    }
    curr = null;
  }

  return result.reverse();
};

export const forEachChildrenDeep = (root: ts.Node, callback: (node: ts.Node) => void) => {
  const queue: ts.Node[] = [root];

  while (queue.length) {
    const node = queue.shift()!;
    callback(node);
    node.forEachChild((child) => void queue.push(child));
  }
};
