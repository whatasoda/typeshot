import ts from 'typescript';
import path from 'path';
import type { TypeshotEntry } from './decls';
import { TemplateSymbols, PrimitiveParameter, NameDescriptor } from '../typeshot';

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

export const createTypeNodeFromPrimitiveParameter = (value: PrimitiveParameter | PrimitiveParameter[]): ts.TypeNode => {
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
    : Array.isArray(value)
    ? ts.createTupleTypeNode(value.map(createTypeNodeFromPrimitiveParameter))
    : ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
};

export const createStringRecordNode = (record: Record<string, string>) => {
  return ts.createObjectLiteral(
    Object.entries(record).map(([name, text]) => {
      return ts.createPropertyAssignment(name, ts.createStringLiteral(text));
    }),
  );
};

export const createStringArrayNode = (array: string[]) => {
  return ts.createArrayLiteral(array.map((text) => ts.createStringLiteral(text)));
};

export const createNameNode = (name: NameDescriptor) => {
  if (typeof name === 'string') {
    return ts.createStringLiteral(name);
  } else if (Array.isArray(name)) {
    return createStringArrayNode(name);
  } else if (typeof name === 'object' && name) {
    return createStringRecordNode(name);
  } else {
    return ts.createNull();
  }
};

export const createTemplateExpression = ([head, ...template]: string[], substitutions: TemplateSymbols[]) => {
  const lastIndex = template.length - 1;
  return ts.createTemplateExpression(
    ts.createTemplateHead(head),
    template.map((text, index) => {
      return ts.createTemplateSpan(
        createTemplateSymbolNode(substitutions[index]),
        ts[index === lastIndex ? 'createTemplateTail' : 'createTemplateMiddle'](text),
      );
    }),
  );
};

const TemplateSymbolKeys = Object.keys(TemplateSymbols) as (keyof typeof TemplateSymbols)[];
export const createTemplateSymbolNode = (symbol: TemplateSymbols) => {
  return ts.createPropertyAccess(
    ts.createPropertyAccess(ts.createIdentifier('typeshot'), ts.createIdentifier('TemplateSymbols')),
    ts.createIdentifier(TemplateSymbolKeys.find((name) => TemplateSymbols[name] === symbol) || ''),
  );
};

export const createTypeshotStatementFromEntry = (entry: TypeshotEntry) => {
  const tag = ts.createCall(
    ts.createPropertyAccess(ts.createIdentifier('typeshot'), 'takeStatic'),
    [entry.type],
    [ts.createStringLiteral(entry.key), createNameNode(entry.name)],
  );
  const template = createTemplateExpression(entry.template, entry.substitutions);

  return ts.createExpressionStatement(ts.createTaggedTemplate(tag, template));
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

export const updateImportPath = (statement: ts.Statement, relative: string) => {
  if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
    const curr = statement.moduleSpecifier.text;
    if (curr.startsWith('.')) {
      const next = path.resolve(relative, curr);
      return ts.updateImportDeclaration(
        statement,
        statement.decorators,
        statement.modifiers,
        statement.importClause,
        ts.createStringLiteral(next),
      );
    }
  } else if (
    ts.isImportEqualsDeclaration(statement) &&
    ts.isExternalModuleReference(statement.moduleReference) &&
    ts.isStringLiteral(statement.moduleReference.expression)
  ) {
    const curr = statement.moduleReference.expression.text;
    if (curr.startsWith('.')) {
      const next = path.resolve(relative, curr);
      return ts.updateImportEqualsDeclaration(
        statement,
        statement.decorators,
        statement.modifiers,
        statement.name,
        ts.createExternalModuleReference(ts.createStringLiteral(next)),
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
