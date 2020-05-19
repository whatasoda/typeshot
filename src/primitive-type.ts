import ts from 'typescript';
import { PrimitiveParameter } from './typeshot';

export const createPrimitiveTypeNodeFactory = (maxDepth: number = 10) => {
  const factory = (value: PrimitiveParameter, depth: number): ts.TypeNode => {
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

  const createMember = ([k, v]: [string, PrimitiveParameter], depth: number) => {
    return ts.createPropertySignature(undefined, k, undefined, factory(v, depth), undefined);
  };

  return (value: PrimitiveParameter) => factory(value, 0);
};
