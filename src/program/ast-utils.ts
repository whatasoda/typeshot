import ts from 'typescript';
import path from 'path';
import type { TypeshotEntry } from './decls';
import { PrimitiveParameter, NameDescriptor } from '../typeshot';

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

export const createTypeshotStatementFromEntry = (entry: TypeshotEntry) => {
  return ts.createExpressionStatement(
    ts.createCall(ts.createIdentifier('typeshot'), [entry.type], [ts.createStringLiteral(entry.key)]),
  );
};

export const getNameEntries = (names: NameDescriptor, type: ts.Type, checker: ts.TypeChecker): [string, ts.Type][] => {
  if (typeof names === 'string') {
    return [[names, type]];
  } else if (typeof names === 'object' && names) {
    return Object.entries(names).reduce<[string, ts.Type][]>((acc, [key, name]) => {
      const property = checker.getPropertyOfType(type, key) as (ts.Symbol & Partial<ts.IncompleteType>) | undefined;
      if (property?.type) acc.push([name, property.type]);
      return acc;
    }, []);
  } else {
    return [];
  }
};

const resolveRelativeImport = (modulePath: string, sourceDir: string, destinationDir: string) => {
  if (!modulePath.startsWith('.')) return null;
  const resolved = path.relative(destinationDir, path.resolve(sourceDir, modulePath));
  return resolved.startsWith('.') ? resolved : `./${resolved}`;
};

export const updateImportPath = (statement: ts.Statement, sourceDir: string, destinationDir: string) => {
  if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
    const modulePath = resolveRelativeImport(statement.moduleSpecifier.text, sourceDir, destinationDir);
    if (modulePath) {
      return ts.updateImportDeclaration(
        statement,
        statement.decorators,
        statement.modifiers,
        statement.importClause,
        ts.createStringLiteral(modulePath),
      );
    }
  } else if (
    ts.isImportEqualsDeclaration(statement) &&
    ts.isExternalModuleReference(statement.moduleReference) &&
    ts.isStringLiteral(statement.moduleReference.expression)
  ) {
    const modulePath = resolveRelativeImport(statement.moduleReference.expression.text, sourceDir, destinationDir);
    if (modulePath) {
      return ts.updateImportEqualsDeclaration(
        statement,
        statement.decorators,
        statement.modifiers,
        statement.name,
        ts.createExternalModuleReference(ts.createStringLiteral(modulePath)),
      );
    }
  }
  return statement;
};

export const TypeshotImportDeclaration = ts.createImportDeclaration(
  undefined,
  undefined,
  ts.createImportClause(ts.createIdentifier('typeshot'), undefined, false),
  ts.createStringLiteral('typeshot'),
);

export const isTypeshotImportDeclaration = (node: ts.Node) => {
  return (
    ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === 'typeshot'
  );
};
