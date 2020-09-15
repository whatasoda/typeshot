import ts from 'typescript';
import { TypeDefinition } from '../typeshot';
import { getNodeByStack, getSourceFileByStack } from '../utils/source-file-search';

export interface ResolvedTypeDefinition extends TypeDefinition {
  range: readonly [number, number];
  sourceFile: ts.SourceFile;
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
  const sourceFile = getSourceFileByStack(definition.stack, getSourceFile);
  const range = parseTypeDefinition(definition, sourceFile);

  const fragmentTemplates = Object.entries(definition.fragmentStacks).reduce<Record<string, TypeFragmentTemplate>>(
    (acc, [id, fragmentStack]) => {
      const { nodePath } = getNodeByStack(fragmentStack, sourceFile, ts.isCallExpression);
      const nearestCallExpression = nodePath[nodePath.length - 1];
      if (!nearestCallExpression.typeArguments || nearestCallExpression.typeArguments.length !== 1) {
        const length = nearestCallExpression.typeArguments?.length || 0;
        throw new RangeError(
          `Invalid Type Argument Range: 'createTypeFragment' requires 1 type argument, but received ${length} at '${id}'`,
        );
      }
      acc[id] = parseFragmentTypeNode(nearestCallExpression.typeArguments[0]);
      return acc;
    },
    {},
  );

  return {
    ...definition,
    range,
    sourceFile,
    fragmentTemplates,
  };
};

const parseTypeDefinition = ({ id, stack }: TypeDefinition, sourceFile: ts.SourceFile) => {
  const { nodePath } = getNodeByStack(stack, sourceFile, ts.isCallExpression);
  const nearestCallExpression = nodePath[nodePath.length - 1];
  const argumentLength = nearestCallExpression.arguments.length;
  if (nearestCallExpression.arguments.length !== 1) {
    throw new RangeError(
      `Invalid Argument Range: 'createTypeDefinition' requires 1 argument, but received ${argumentLength} at '${id}'`,
    );
  }

  const factory = nearestCallExpression.arguments[0];
  if (!ts.isFunctionExpression(factory) && !ts.isArrowFunction(factory)) {
    throw new TypeError(
      `Invalid Argument: 'createTypeDefinition' requires simple function as an argument, check '${id}'`,
    );
  }

  return [factory.getStart(), factory.getEnd()] as const;
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
