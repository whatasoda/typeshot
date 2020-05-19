import ts from 'typescript';
import { flattenCallLikeExpressionChain } from '../ast-utils';
import { AddReplecement } from '../transform';
import { TypeInformation } from '../decls';
import typeshot from '../../typeshot';

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

const INJECTION_INDEX: Partial<Record<keyof typeof typeshot, number>> = {
  createDynamic: 1,
  printStatic: 1,
};
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

  if (method in INJECTION_INDEX) {
    const index = INJECTION_INDEX[method]!;
    if (args.length !== index) {
      throw new Error(`Expected ${index} args, but got ${args.length}.`);
    }

    const key = `${types.size}`;
    const [type] = typeArguments;
    types.set(key, { key, type });
    if (args.length) {
      const pos = args[args.length - 1].end;
      replaceOnExecution(pos, pos, `, '${key}'`);
    } else {
      const pos = expression.end - 1;
      replaceOnExecution(pos, pos, `, '${key}'`);
    }
  }

  return true;
};
