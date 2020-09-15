import ts from 'typescript';
import { TypeDefinitionInfo } from '../typeshot';
import { getNodeByStack, getSourceFileByStack } from '../utils/source-file-search';
import { forEachChildDeep } from './ast-utils';

export interface ResolvedTypeDefinition extends TypeDefinitionInfo {
  transformRange: readonly [start: number, end: number];
  sourceFile: ts.SourceFile;
  fragmentTemplates: Map<string, TypeFragmentTemplate>;
}

interface TypeFragmentTemplate {
  fragmentText: string;
  template: string[];
  /** item should be a dependency name */
  substitutions: string[];
}

export const resolveTypeDefinition = (
  definition: TypeDefinitionInfo,
  getSourceFile: (filename: string) => ts.SourceFile | null,
) => {
  const sourceFile = getSourceFileByStack(definition.stack, getSourceFile);
  const transformRange = parseTypeDefinition(definition, sourceFile);
  const fragmentTemplates = resolveFragments(definition, sourceFile);

  return {
    ...definition,
    transformRange,
    sourceFile,
    fragmentTemplates,
  };
};

const parseTypeDefinition = ({ id, stack }: TypeDefinitionInfo, sourceFile: ts.SourceFile) => {
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

const resolveFragments = ({ fragments }: TypeDefinitionInfo, sourceFile: ts.SourceFile) => {
  const templates = new Map<string, TypeFragmentTemplate>();
  fragments.forEach((stack, id) => {
    const { nodePath } = getNodeByStack(stack, sourceFile, ts.isCallExpression);
    const nearestCallExpression = nodePath[nodePath.length - 1];
    if (!nearestCallExpression.typeArguments || nearestCallExpression.typeArguments.length !== 1) {
      const length = nearestCallExpression.typeArguments?.length || 0;
      throw new RangeError(
        `Invalid Type Argument Range: 'createTypeFragment' requires 1 type argument, but received ${length} at '${id}'`,
      );
    }
    templates.set(id, parseFragmentTypeNode(nearestCallExpression.typeArguments[0]));
  });
  return templates;
};

const parseFragmentTypeNode = (
  fragmentTypeNode: ts.TypeNode,
  sourceText: string = fragmentTypeNode.getSourceFile().getFullText(),
): TypeFragmentTemplate => {
  const fragmentText = fragmentTypeNode.getText();
  const template: string[] = [];
  const substitutions: string[] = [];
  let cursor = fragmentTypeNode.getStart();
  forEachChildDeep(fragmentTypeNode, (node) => {
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
