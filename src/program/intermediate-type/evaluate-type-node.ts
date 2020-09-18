import ts from 'typescript';
import { TypeInstance } from '../../typeshot';
import { AstTemplate } from '../../utils/ast-template';
import { defaultBuilderFlags, dummyFile, INTEGRATE, patternEVAL } from './constants';

export const evaluateIntermediateTypeNode = (
  member: ts.TypeElement,
  sourceText: string,
  checker: ts.TypeChecker,
  printer: ts.Printer,
  builderFlags?: ts.NodeBuilderFlags,
) => {
  if (ts.isPropertySignature(member) && ts.isNumericLiteral(member.name) && member.type) {
    const { type, name } = member;
    const id = name.text;
    const literal = new IntermediateTypeAstTemplate(type, sourceText).serialize(checker, printer, builderFlags);
    const isInterfaceLike = isInterfaceLikeType(type);

    const generate = ({ format, name }: TypeInstance) => {
      if (format === 'literal') {
        return literal;
      } else {
        return isInterfaceLike && format === 'interface'
          ? `interface ${name} ${literal}`
          : `type ${name} = ${literal};`;
      }
    };

    return { id, generate };
  }
  throw new Error('');
};

const isInterfaceLikeType = (node: ts.Node) => {
  if (ts.isTypeReferenceNode(node) && node.typeName.getText() === INTEGRATE) {
    return true;
  }
  return ts.isTypeLiteralNode(node) || ts.isMappedTypeNode(node);
};

export class IntermediateTypeAstTemplate extends AstTemplate<
  ts.TypeNode,
  [checker: ts.TypeChecker, printer: ts.Printer, builderFlags?: ts.NodeBuilderFlags]
> {
  protected getSubstitution(node: ts.Node) {
    if (ts.isTypeReferenceNode(node) && node.typeName.getText() === INTEGRATE) {
      return node;
    } else if (
      ts.isParenthesizedTypeNode(node) &&
      ts.isParenthesizedTypeNode(node.type) &&
      patternEVAL.test(node.type.getFullText())
    ) {
      return node;
    } else {
      return null;
    }
  }
  protected serializeSubstitution(
    node: ts.TypeNode,
    checker: ts.TypeChecker,
    printer: ts.Printer,
    builderFlags: ts.NodeBuilderFlags = defaultBuilderFlags,
  ) {
    const type = checker.getTypeFromTypeNode(node);
    const resolvedType = checker.typeToTypeNode(type, undefined, builderFlags);
    if (!resolvedType) throw new Error('');
    return printer.printNode(ts.EmitHint.Unspecified, resolvedType, dummyFile);
  }
}
