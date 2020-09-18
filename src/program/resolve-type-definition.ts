import ts from 'typescript';
import { TypeDefinitionInfo, TypeInstance } from '../typeshot';
import { CodeStack } from '../utils/stack-tracking';
import { getNodeByPosition, getNodeByStack, getSourceFileByStack } from '../utils/ast';
import { ComposedTemplate, parseFragment } from './parse-fragment-type-node';
import { resolveIntermediateTypeInstance } from './resolve-type-instance';

export class TypeDefinition {
  public readonly id: string;
  public readonly stack: CodeStack;
  public readonly start: number;
  public readonly end: number;
  public readonly rawSourceFile: ts.SourceFile;
  public readonly fragments: Map<string, ComposedTemplate> = new Map();
  public readonly intermediateTypes: Map<TypeInstance, string> = new Map();
  public readonly intermediateContent: string = '() => {}';
  public readonly intermediateFilePosition: { readonly start: number; readonly end: number } | null = null;
  public readonly types: Map<string, (instance: TypeInstance) => string> = new Map();

  constructor(definition: TypeDefinitionInfo, getSourceFile: (filename: string) => ts.SourceFile | null) {
    this.id = definition.id;
    this.stack = definition.stack;
    this.rawSourceFile = getSourceFileByStack(definition.stack, getSourceFile);
    [this.start, this.end] = parseTypeDefinition(definition, this.rawSourceFile);
    resolveFragments(this.fragments, definition, this.rawSourceFile);
  }

  public prepareIntermediateContent() {
    if (this.intermediateContent !== '() => {}') throw new Error('TODO');
    let acc: string = '';
    this.intermediateTypes.forEach((typeString, token) => {
      acc += `${token.id}: ${typeString};`;
    });
    const intermediateContent = `() => {type _ = {${acc}};}`;
    Object.assign(this, { intermediateContent });
  }

  public setIntermediatePosition(start: number) {
    if (this.intermediateFilePosition) throw new Error('TODO');
    const end = start + this.intermediateContent.length;
    Object.assign(this, { intermediateFilePosition: { start, end } });
  }
}

export const resolveTypeDefinition = (
  definition: TypeDefinitionInfo,
  getSourceFile: (filename: string) => ts.SourceFile | null,
) => {
  return new TypeDefinition(definition, getSourceFile);
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

const resolveFragments = (
  acc: Map<string, ComposedTemplate>,
  { fragments }: TypeDefinitionInfo,
  sourceFile: ts.SourceFile,
) => {
  const sourceText = sourceFile.getFullText();
  fragments.forEach((stack, id) => {
    const { nodePath } = getNodeByStack(stack, sourceFile, ts.isCallExpression);
    const nearestCallExpression = nodePath[nodePath.length - 1];
    if (!nearestCallExpression.typeArguments || nearestCallExpression.typeArguments.length !== 1) {
      const length = nearestCallExpression.typeArguments?.length || 0;
      throw new RangeError(
        `Invalid Type Argument Range: 'createTypeFragment' requires 1 type argument, but received ${length} at '${id}'`,
      );
    }
    acc.set(id, parseFragment(nearestCallExpression.typeArguments[0], sourceText));
  });
};

export const resolveIntermediateDefinition = (
  definition: TypeDefinition,
  program: ts.Program,
  checker: ts.TypeChecker,
  printer: ts.Printer,
  builderFlags?: ts.NodeBuilderFlags,
) => {
  if (!definition.intermediateFilePosition) throw new Error();

  const sourceFile = program.getSourceFile(definition.rawSourceFile.fileName);
  if (!sourceFile) throw new Error('');

  const pos = definition.intermediateFilePosition.start + /* '() => {type _ = ' */ 16;
  const { node } = getNodeByPosition(pos, sourceFile);
  if (!ts.isTypeLiteralNode(node)) throw new Error('');

  const sourceText = sourceFile.getFullText();
  node.members.forEach((member) => {
    const { id, typeFunc } = resolveIntermediateTypeInstance(member, sourceText, checker, printer, builderFlags);
    definition.types.set(id, typeFunc);
  });
};
