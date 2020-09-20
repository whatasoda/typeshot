import ts from 'typescript';
import path from 'path';
import { AddReplecement } from '../transform';

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

export const resolveRelativeImport = (modulePath: string, sourceDir: string, destinationDir: string) => {
  if (!modulePath.startsWith('.')) return modulePath;
  const resolved = path.relative(destinationDir, path.resolve(sourceDir, modulePath));
  return resolved.startsWith('.') ? resolved : `./${resolved}`;
};

export const createModulePathResolver = (replace: AddReplecement, sourceDir: string, destinationDir: string) => {
  return (node: ts.Node): boolean => {
    const modulePathNode = getModulePathNode(node);
    if (modulePathNode) {
      const pos = modulePathNode.end - modulePathNode.text.length - 1;
      const end = modulePathNode.end - 1;

      replace(pos, end, (modulePath) => resolveRelativeImport(modulePath, sourceDir, destinationDir));
      return true;
    }
    return false;
  };
};

export const isTypeshotImportDeclaration = (node: ts.Node) => {
  return (
    ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === 'typeshot'
  );
};
