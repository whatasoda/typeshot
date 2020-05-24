import ts from 'typescript';
import { flattenCallLikeExpressionChain } from '../ast-utils';
import { AddReplecement } from '../transform';
import typeshot from '../../typeshot';
import { TypeInformation } from '../../context';

type OneOfMethodName = {
  [K in keyof typeof typeshot]: typeof typeshot[K] extends (...args: any[]) => any ? K : never;
}[keyof typeof typeshot];

interface ParsedMethod {
  chain: ReturnType<typeof flattenCallLikeExpressionChain>;
  method: OneOfMethodName;
  node: ts.Node;
  expression: ts.CallExpression;
  arguments: ts.Expression[];
  typeArguments: ts.TypeNode[];
}

const parseTypeshotMethods = (node: ts.Node): ParsedMethod | null => {
  let expression: ts.Expression | null = null;

  if (ts.isExpressionStatement(node)) {
    expression = node.expression;
  } else if (ts.isVariableStatement(node)) {
    if (node.declarationList.declarations.length === 1) {
      const [{ initializer }] = node.declarationList.declarations;
      if (initializer) expression = initializer;
    } else {
      // eslint-disable-next-line no-console
      console.warn('Do not use multiple decralation for typeshot method.');
    }
  }

  if (!expression) return null;

  const chain = flattenCallLikeExpressionChain(expression);
  const [top] = chain;
  if (
    top &&
    ts.isCallExpression(top) && // TODO: detect `createTemplate`
    ts.isPropertyAccessExpression(top.expression) &&
    ts.isIdentifier(top.expression.expression) &&
    top.expression.expression.text === 'typeshot'
  ) {
    const method = top.expression.name.text as OneOfMethodName;

    if (!(method in typeshot)) return null;
    return {
      chain,
      method,
      node,
      expression: top,
      arguments: [...top.arguments],
      typeArguments: top.typeArguments ? [...top.typeArguments] : [],
    };
  }

  return null;
};

const ID_INJECTION_INDEX = 1;

export const handleTypeshotMethod = (
  types: Map<string, TypeInformation>,
  node: ts.Node,
  replaceOnExecution: AddReplecement,
  replaceOnIntermediateFile: AddReplecement,
): boolean => {
  const parsed = parseTypeshotMethods(node);
  if (!parsed) return false;

  replaceOnIntermediateFile(node.pos, node.end, '');
  const { method, expression, typeArguments, arguments: args } = parsed;

  if (method === 'createType') {
    if (args.length !== ID_INJECTION_INDEX) {
      throw new Error(`Expected ${ID_INJECTION_INDEX} args, but got ${args.length}.`);
    }

    const rootId = `${types.size}`;
    const [type] = typeArguments;
    types.set(rootId, { rootId, type });
    if (args.length) {
      const pos = args[args.length - 1].end;
      replaceOnExecution(pos, pos, `, '${rootId}'`);
    } else {
      const pos = expression.end - 1;
      replaceOnExecution(pos, pos, `, '${rootId}'`);
    }
  }

  return true;
};
