import ts from 'typescript';
import type { TypeshotEntry } from './decls';
import { PrimitiveParameter } from '../typeshot';

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

export const createTypeNodeFromPrimitiveParameter = (value: PrimitiveParameter, depth = 0): ts.TypeNode => {
  return value === null
    ? ts.createNull()
    : value === undefined
    ? ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)
    : typeof value === 'boolean'
    ? ts.createLiteralTypeNode(ts.createLiteral(value))
    : typeof value === 'string'
    ? ts.createLiteralTypeNode(ts.createStringLiteral(value))
    : typeof value === 'number'
    ? ts.createLiteralTypeNode(ts.createNumericLiteral(`${value}`))
    : typeof value === 'object' && depth === 0
    ? Array.isArray(value)
      ? ts.createTupleTypeNode(value.map((v) => createTypeNodeFromPrimitiveParameter(v, depth + 1)))
      : ts.createTypeLiteralNode(
          Object.entries(value).map(([k, v]) =>
            ts.createPropertySignature(
              undefined,
              k,
              undefined,
              createTypeNodeFromPrimitiveParameter(v, depth + 1),
              undefined,
            ),
          ),
        )
    : ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
};

const INTERMEDIATE_TYPE_NAME = '__TYPESHOT_INTERMEDIATE__';
export const createIntermediateType = (entries: TypeshotEntry[]) => {
  return ts.createInterfaceDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    INTERMEDIATE_TYPE_NAME,
    undefined,
    undefined,
    entries.map(({ key, type }) => {
      return ts.createPropertySignature(undefined, ts.createStringLiteral(key), undefined, type, undefined);
    }),
  );
};

export const isTypeshotImportDeclaration = (statement: ts.Statement) => {
  return (
    ts.isImportDeclaration(statement) &&
    ts.isStringLiteral(statement.moduleSpecifier) &&
    statement.moduleSpecifier.text === 'typeshot'
  );
};
