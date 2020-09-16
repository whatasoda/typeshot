import ts from 'typescript';
import { TypeDefinitionInfo, TypeInstance } from '../typeshot';
import { CodeStack } from '../utils/stack-tracking';
import { forEachChildDeep, getNodeByPosition, getNodeByStack, getSourceFileByStack } from '../utils/ast';

interface TypeFragmentTemplate {
  fragmentText: string;
  templateStrings: TemplateStringsArray;
  /** item should be a dependency name */
  substitutions: string[];
}

export class TypeDefinition {
  public readonly id: string;
  public readonly stack: CodeStack;
  public readonly start: number;
  public readonly end: number;
  public readonly rawSourceFile: ts.SourceFile;
  public readonly fragments: Map<string, TypeFragmentTemplate> = new Map();
  public readonly intermediateTypes: Map<TypeInstance, string> = new Map();
  public readonly intermediateContent: string = '() => {}';
  public readonly intermediateFilePosition: { readonly start: number; readonly end: number } | null = null;
  public readonly types: Map<string, string> = new Map();

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
  acc: Map<string, TypeFragmentTemplate>,
  { fragments }: TypeDefinitionInfo,
  sourceFile: ts.SourceFile,
) => {
  fragments.forEach((stack, id) => {
    const { nodePath } = getNodeByStack(stack, sourceFile, ts.isCallExpression);
    const nearestCallExpression = nodePath[nodePath.length - 1];
    if (!nearestCallExpression.typeArguments || nearestCallExpression.typeArguments.length !== 1) {
      const length = nearestCallExpression.typeArguments?.length || 0;
      throw new RangeError(
        `Invalid Type Argument Range: 'createTypeFragment' requires 1 type argument, but received ${length} at '${id}'`,
      );
    }
    acc.set(id, parseFragmentTypeNode(nearestCallExpression.typeArguments[0]));
  });
};

const parseFragmentTypeNode = (
  fragmentTypeNode: ts.TypeNode,
  sourceText: string = fragmentTypeNode.getSourceFile().getFullText(),
): TypeFragmentTemplate => {
  const fragmentText = fragmentTypeNode.getText();
  const raw: string[] = [];
  const templateStrings = Object.assign(raw, { raw });
  const substitutions: string[] = [];
  let cursor = fragmentTypeNode.getStart();
  forEachChildDeep(fragmentTypeNode, (node) => {
    if (ts.isTypeQueryNode(node)) {
      templateStrings.push(sourceText.slice(cursor, node.getStart()));
      const dependencyName = node.exprName.getText();
      substitutions.push(dependencyName);
      cursor = node.getEnd();
    }
  });
  templateStrings.push(sourceText.slice(cursor, fragmentTypeNode.getEnd()));

  return { fragmentText, templateStrings, substitutions };
};

const dummySource = ts.createSourceFile('__dummy__.ts', '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
const defaultBuilderFlags =
  ts.NodeBuilderFlags.InTypeAlias |
  ts.NodeBuilderFlags.NoTruncation |
  ts.NodeBuilderFlags.IgnoreErrors |
  ts.NodeBuilderFlags.GenerateNamesForShadowedTypeParams |
  ts.NodeBuilderFlags.UseAliasDefinedOutsideCurrentScope |
  0;
export const resolveIntermediateDefinition = (
  definition: TypeDefinition,
  program: ts.Program,
  checker: ts.TypeChecker,
  printer: ts.Printer,
  builderFlags: ts.NodeBuilderFlags = defaultBuilderFlags,
) => {
  if (!definition.intermediateFilePosition) throw new Error();

  const sourceFile = program.getSourceFile(definition.rawSourceFile.fileName);
  if (!sourceFile) throw new Error('');

  const pos = definition.intermediateFilePosition.start + /* '() => {type _ = ' */ 16;
  const { node } = getNodeByPosition(pos, sourceFile);
  if (!ts.isTypeLiteralNode(node)) throw new Error('');

  node.members.forEach((member) => {
    if (!ts.isPropertySignature(member) || !ts.isNumericLiteral(member.name) || !member.type) throw new Error('');

    const type = checker.getTypeFromTypeNode(member.type);
    // TODO: extra optimization by myself
    const resolvedType = checker.typeToTypeNode(type, undefined, builderFlags);
    if (!resolvedType) throw new Error('');

    // TODO: format
    const literal = printer.printNode(ts.EmitHint.Unspecified, resolvedType, dummySource);
    definition.types.set(member.name.text, literal);
  });
};
