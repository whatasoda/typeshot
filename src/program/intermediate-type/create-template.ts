import ts from 'typescript';
import { getNodeByStack } from '../../utils/ast';
import { AstTemplate } from '../../utils/ast-template';
import { TypeFragmentInfo } from '../type-definition';

interface TemplateSector {
  types: FragmentAstTemplate[];
  sigs: FragmentAstTemplate[];
}

interface TemporaryTemplates {
  soluble: TemplateSector;
  insoluble: TemplateSector;
}

export interface FragmentTemplate {
  solubleSigs: FragmentAstTemplate | null;
  solubleTypes: FragmentAstTemplate | null;
  insolubleSigs: FragmentAstTemplate | null;
  insolubleTypes: FragmentAstTemplate | null;
}

export class FragmentAstTemplate extends AstTemplate<string, [dependencies: Map<string, string>]> {
  protected getSubstitution(node: ts.Node) {
    return ts.isTypeQueryNode(node) ? node.exprName.getText() : null;
  }
  protected serializeSubstitution(dependencyName: string, dependencies: Map<string, string>) {
    if (dependencies.has(dependencyName)) {
      return dependencies.get(dependencyName)!;
    } else {
      throw new Error(`Dependency Not Found: dependency ${dependencyName} is missed.`);
    }
  }
}

export const createFragmentTemplate = (
  fragmentInfo: TypeFragmentInfo,
  sourceFile: ts.SourceFile,
  sourceText: string,
): FragmentTemplate => {
  const { nodePath } = getNodeByStack(fragmentInfo.stack, sourceFile, ts.isCallExpression);
  const nearestCallExpression = nodePath[nodePath.length - 1];
  if (!nearestCallExpression.typeArguments || nearestCallExpression.typeArguments.length !== 1) {
    const length = nearestCallExpression.typeArguments?.length || 0;
    throw new RangeError(
      `Invalid Type Argument Range: 'createTypeFragment' requires 1 type argument, but received ${length} at '${fragmentInfo.id}'`,
    );
  }

  const node = nearestCallExpression.typeArguments[0];
  if (fragmentInfo.forceIntegrate) {
    return {
      solubleSigs: null,
      solubleTypes: new FragmentAstTemplate(node, sourceText).wrap('(', ')'),
      insolubleSigs: null,
      insolubleTypes: null,
    };
  }

  const { soluble: S, insoluble: I } = parseFragmentTypeNode(undefined, node, sourceText);
  return {
    solubleSigs: S.sigs.length ? new FragmentAstTemplate(null).append(S.sigs) : null,
    solubleTypes: S.types.length ? new FragmentAstTemplate(null).append(S.types, ' & ') : null,
    insolubleSigs: I.sigs.length ? new FragmentAstTemplate(null).append(I.sigs) : null,
    insolubleTypes: I.types.length ? new FragmentAstTemplate(null).append(I.types, ' & ') : null,
  };
};

export const parseFragmentTypeNode = (
  acc: TemporaryTemplates = { soluble: { types: [], sigs: [] }, insoluble: { types: [], sigs: [] } },
  node: ts.TypeNode,
  sourceText: string,
) => {
  const { soluble, insoluble } = acc;
  while (ts.isParenthesizedTypeNode(node)) node = node.type;

  if (ts.isIntersectionTypeNode(node)) {
    node.types.forEach((member) => {
      parseFragmentTypeNode(acc, member, sourceText);
    });
  } else if (ts.isTypeLiteralNode(node)) {
    node.members.forEach((member) => {
      const template = new FragmentAstTemplate(member, sourceText).ensureEnd(';');
      if (ts.isMethodSignature(member) || ts.isPropertySignature(member) || ts.isIndexSignatureDeclaration(member)) {
        soluble.sigs.push(template);
      } else if (ts.isCallSignatureDeclaration(member) || ts.isConstructSignatureDeclaration(member)) {
        insoluble.sigs.push(template);
      }
    });
  } else {
    const template = new FragmentAstTemplate(node, sourceText);
    if (ts.isMappedTypeNode(node)) {
      soluble.types.push(template);
    } else if (ts.isUnionTypeNode(node) || ts.isConditionalTypeNode(node)) {
      insoluble.types.push(template.wrap('(', ')'));
    } else {
      insoluble.types.push(template);
    }
  }
  return acc;
};
