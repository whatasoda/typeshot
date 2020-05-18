import ts from 'typescript';
import { flattenCallLikeExpressionChain } from './ast-utils';
import typeshot from '../typeshot';

type OneOfMethodName = {
  [K in keyof typeof typeshot]: typeof typeshot[K] extends (...args: any[]) => any ? K : never;
}[keyof typeof typeshot];

interface ParsedMethod {
  chain: ReturnType<typeof flattenCallLikeExpressionChain>;
  method: OneOfMethodName;
  statement: ts.Statement;
  expression: ts.CallExpression;
  arguments: ts.Expression[];
  typeArguments: ts.TypeNode[];
}

export const parseTypeshotMethods = (statement: ts.Statement): ParsedMethod | null => {
  let expression: ts.Expression | null = null;

  if (ts.isExpressionStatement(statement)) {
    expression = statement.expression;
  } else if (ts.isVariableStatement(statement)) {
    if (statement.declarationList.declarations.length === 1) {
      const [{ initializer }] = statement.declarationList.declarations;
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
      statement,
      expression: top,
      arguments: [...top.arguments],
      typeArguments: top.typeArguments ? [...top.typeArguments] : [],
    };
  }

  return null;
};

export const parseIntermediateTypeshot = (statement: ts.Statement) => {
  if (
    !(
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      ts.isIdentifier(statement.expression.expression) &&
      statement.expression.expression.text === 'typeshot' &&
      statement.expression.arguments.length === 1 &&
      statement.expression.typeArguments?.length === 1
    )
  ) return null; // eslint-disable-line prettier/prettier

  const [keyNode] = statement.expression.arguments;
  const [type] = statement.expression.typeArguments;
  if (!ts.isStringLiteral(keyNode)) return null;

  return { key: keyNode.text, type };
};

export const getModulePathNode = (node: ts.Node): ts.StringLiteral | null => {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier;
  }

  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    ts.isStringLiteral(node.moduleReference.expression)
  ) {
    return node.moduleReference.expression;
  }

  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
    return node.argument.literal;
  }

  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0] as ts.StringLiteral;
  }

  return null;
};
