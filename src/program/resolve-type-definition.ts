import ts from 'typescript';
import { TypeDefinitionInfo, TypeInstance } from '../typeshot';
import { CodeStack } from '../utils/stack-tracking';
import { getNodeByPosition, getNodeByStack, getSourceFileByStack } from '../utils/ast';
import { FragmentTemplate, createFragmentTemplate } from './parse-fragment-type-node';
import { evaluateMediationTypeNode } from './resolve-type-instance';

export class TypeDefinition {
  public readonly definition: this;
  public readonly id: string;
  public readonly stack: CodeStack;
  public readonly start: number;
  public readonly end: number;
  public readonly sourceFile: ts.SourceFile;
  public readonly sourceText: string;
  public readonly fragmentTempaltes: Map<string, FragmentTemplate> = new Map();
  public readonly imdTypes: Map<TypeInstance, string> = new Map();
  public readonly types: Map<string, (instance: TypeInstance) => string> = new Map();
  public imdStart: number = 0;

  constructor(definition: TypeDefinitionInfo, getSourceFile: (filename: string) => ts.SourceFile | null) {
    this.definition = this;
    this.id = definition.id;
    this.stack = definition.stack;
    this.sourceFile = getSourceFileByStack(definition.stack, getSourceFile);
    [this.start, this.end] = varidateTypeDefinition(definition, this.sourceFile);
    this.sourceText = this.sourceFile.getFullText();
    definition.fragments.forEach((stack, id) => {
      this.fragmentTempaltes.set(id, createFragmentTemplate(id, stack, this.sourceFile, this.sourceText));
    });
  }

  public createMediationTypeText(currentContentLength: number): string {
    let acc: string = '';
    this.imdTypes.forEach((typeString, token) => {
      acc += `${token.id}: ${typeString};`;
    });
    const typeText = `() => {type _ = {${acc}};}`;
    this.imdStart = currentContentLength + 16 /* '() => {type _ = ' */;

    return typeText;
  }
}

export const resolveTypeDefinition = (
  definition: TypeDefinitionInfo,
  getSourceFile: (filename: string) => ts.SourceFile | null,
) => {
  return new TypeDefinition(definition, getSourceFile);
};

const varidateTypeDefinition = ({ id, stack }: TypeDefinitionInfo, sourceFile: ts.SourceFile) => {
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

export const resolveImdDefinition = (
  { sourceFile, imdStart: mediationStart, types }: TypeDefinition,
  program: ts.Program,
  checker: ts.TypeChecker,
  printer: ts.Printer,
  builderFlags?: ts.NodeBuilderFlags,
) => {
  const imdFile = program.getSourceFile(sourceFile.fileName);
  if (!imdFile) throw new Error('');

  const { node } = getNodeByPosition(mediationStart, imdFile);
  if (!ts.isTypeLiteralNode(node)) throw new Error('');

  const sourceText = imdFile.getFullText();
  node.members.forEach((member) => {
    const { id, typeFunc } = evaluateMediationTypeNode(member, sourceText, checker, printer, builderFlags);
    types.set(id, typeFunc);
  });
};
