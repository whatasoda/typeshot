import ts from 'typescript';
import path from 'path';
import { forEachChildDeep } from '../utils/ast';
import { TraceTransform, TraceTransformHoleyArray } from './resolve-source-trace';

export const collectImportPathTransform = (
  acc: TraceTransformHoleyArray,
  sourceFile: ts.SourceFile,
  from: string,
  to: string,
) => {
  forEachChildDeep(sourceFile, (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const transform = createImportPathTransform(node.moduleSpecifier, from, to);
      acc.push(transform);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      const transform = createImportPathTransform(node.moduleReference.expression, from, to);
      acc.push(transform);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      const transform = createImportPathTransform(node.argument.literal, from, to);
      acc.push(transform);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const transform = createImportPathTransform(node.arguments[0] as ts.StringLiteral, from, to);
      acc.push(transform);
    }
  });
  return acc;
};

export const createImportPathTransform = (node: ts.StringLiteral, from: string, to: string): TraceTransform => {
  const start = node.getStart() + 1;
  const end = node.getEnd() - 1;
  const content = resolveRelativeImportPath(node.text, from, to);
  return { start, end, content };
};

export const resolveRelativeImportPath = (modulePath: string, from: string, to: string) => {
  if (!modulePath.startsWith('.')) return modulePath;
  const resolved = path.relative(to, path.resolve(from, modulePath));
  return resolved.startsWith('.') ? resolved : `./${resolved}`;
};
