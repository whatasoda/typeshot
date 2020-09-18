import ts from 'typescript';
import { FragmentDependencies } from '../typeshot';
import { AstTemplate } from '../utils/ast-template';

interface TemplateSector {
  types: FragmentAstTemplate[];
  signatures: FragmentAstTemplate[];
}

interface ParsedTemplates {
  crossable: TemplateSector;
  exceptional: TemplateSector;
}

export interface ComposedTemplate {
  crossableTypes: FragmentAstTemplate | null;
  crossableSignatures: FragmentAstTemplate | null;
  exceptionalTypes: FragmentAstTemplate | null;
  exceptionalSignatures: FragmentAstTemplate | null;
}

export class FragmentAstTemplate extends AstTemplate<string, [dependencies: FragmentDependencies]> {
  protected getSubstitution(node: ts.Node) {
    return ts.isTypeQueryNode(node) ? node.exprName.getText() : null;
  }
  protected serializeSubstitution(dependencyName: string, dependencies: FragmentDependencies) {
    if (dependencyName in dependencies) {
      return JSON.stringify(dependencies[dependencyName]);
    } else {
      throw new Error(`Dependency Not Found: dependency ${dependencyName} is missed.`);
    }
  }
}

export const parseFragment = (node: ts.TypeNode, sourceText: string): ComposedTemplate => {
  const { crossable: C, exceptional: E } = parseTypeNode(undefined, node, sourceText);
  const crossableTypes = C.types.length ? new FragmentAstTemplate(null).append(C.types, ' & ') : null;
  const exceptionalTypes = E.types.length ? new FragmentAstTemplate(null).append(E.types, ' & ') : null;
  const crossableSignatures = C.signatures.length ? new FragmentAstTemplate(null).append(C.signatures) : null;
  const exceptionalSignatures = E.signatures.length ? new FragmentAstTemplate(null).append(E.signatures) : null;
  return { crossableTypes, crossableSignatures, exceptionalTypes, exceptionalSignatures };
};

export const parseTypeNode = (
  acc: ParsedTemplates = { crossable: { types: [], signatures: [] }, exceptional: { types: [], signatures: [] } },
  node: ts.TypeNode,
  sourceText: string,
) => {
  const { crossable, exceptional } = acc;
  while (ts.isParenthesizedTypeNode(node)) node = node.type;

  if (ts.isIntersectionTypeNode(node)) {
    node.types.forEach((member) => {
      parseTypeNode(acc, member, sourceText);
    });
  } else if (ts.isTypeLiteralNode(node)) {
    node.members.forEach((member) => {
      const template = new FragmentAstTemplate(member, sourceText).ensureEnd(';');
      if (ts.isMethodSignature(member) || ts.isPropertySignature(member) || ts.isIndexSignatureDeclaration(member)) {
        crossable.signatures.push(template);
      } else if (ts.isCallSignatureDeclaration(member) || ts.isConstructSignatureDeclaration(member)) {
        exceptional.signatures.push(template);
      }
    });
  } else {
    const template = new FragmentAstTemplate(node, sourceText);
    if (ts.isMappedTypeNode(node)) {
      crossable.types.push(template);
    } else if (ts.isUnionTypeNode(node) || ts.isConditionalTypeNode(node)) {
      exceptional.types.push(template.wrap('(', ')'));
    } else {
      exceptional.types.push(template);
    }
  }
  return acc;
};
