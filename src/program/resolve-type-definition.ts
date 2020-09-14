import ts from 'typescript';
import type { TypeDefinition } from '../registerTypeDefinition';
import { getNodeByStack } from '../utils/source-file-search';

export interface ResolvedTypeDefinition extends TypeDefinition {
  fragmentTemplates: Record<string, TypeFragmentTemplate>;
}

interface TypeFragmentTemplate {
  fragmentText: string;
  template: string[];
  substitutions: string[];
}

export const resolveTypeDefinition = (
  definition: TypeDefinition,
  getSourceFile: (filename: string) => ts.SourceFile | null,
): ResolvedTypeDefinition => {
  const fragmentTypeNodes = Object.entries(definition.fragmentStacks).reduce<Record<string, TypeFragmentTemplate>>(
    (acc, [id, fragmentStack]) => {
      // TODO: increase performance by getting source file in advance
      const { ancestors } = getNodeByStack(fragmentStack, getSourceFile, ts.isCallExpression);
      const nearestCallExpression = ancestors[ancestors.length - 1];
      if (!nearestCallExpression.typeArguments || nearestCallExpression.typeArguments.length !== 1) {
        const length = nearestCallExpression.typeArguments?.length || 0;
        throw new RangeError(
          `Invalid Type Argument Range: 'createTypeFragment' requires 1 type argument, but received ${length} at ${id}`,
        );
      }

      acc[id] = parseFragmentTypeNode(nearestCallExpression.typeArguments[0]);
      return acc;
    },
    {},
  );
  return { ...definition, fragmentTemplates: fragmentTypeNodes };
};

const parseFragmentTypeNode = (
  fragmentTypeNode: ts.TypeNode,
  sourceText: string = fragmentTypeNode.getSourceFile().getFullText(),
): TypeFragmentTemplate => {
  const fragmentText = fragmentTypeNode.getText();
  const template: string[] = [];
  const substitutions: string[] = [];
  let cursor = fragmentTypeNode.getStart();
  ts.forEachChild(fragmentTypeNode, (node) => {
    if (ts.isTypeQueryNode(node)) {
      template.push(sourceText.slice(cursor, node.getStart()));
      const dependencyName = node.exprName.getText();
      substitutions.push(dependencyName);
      cursor = node.getEnd();
    }
  });
  template.push(sourceText.slice(cursor, fragmentTypeNode.getEnd()));

  return { fragmentText, template, substitutions };
};
