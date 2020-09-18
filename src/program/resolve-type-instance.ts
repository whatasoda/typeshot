import ts from 'typescript';
import { FragmentDependencies, TypeKind, TypeInstance } from '../typeshot';
import { AstTemplate } from '../utils/ast-template';
import { getSymbolName } from '../utils/converters';
import type { TypeDefinition } from './resolve-type-definition';

export const resolveTypeInstance = (instance: TypeInstance, definitions: Map<string, TypeDefinition>) => {
  const { definitionId, value } = instance;
  const definition = definitions.get(definitionId);
  if (!definition) {
    throw new Error(`Unknown Type Definition: type definition '${definitionId}' is not found`);
  }
  definition.imdTypes.set(instance, createMediationTypeText(value, definition));
};

export interface IntermediateTypeAccumulator {
  solubleSigs: string[];
  solubleTypes: string[];
  insolubleSigs: string[];
  insolubleTypes: string[];
  nestedInsolubleSigs: string[];
}

const createMediationTypeText = (
  value: any,
  definition: TypeDefinition,
  resolved: Set<any> = new Set(),
  onNestedSolutionFound?: () => void,
): string => {
  switch (value) {
    case null:
      return 'null';
    case void 0:
      return 'undefined';
  }

  const { id: definitionId, fragmentTempaltes } = definition;
  switch (typeof value) {
    case 'boolean':
    case 'string':
    case 'number':
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      throw new TypeError(`Unsupported Value Type '${typeof value}': check type definition '${definitionId}'`);
  }

  if (resolved.has(value)) {
    throw new Error(`Unexpected Circular Reference: check type definition '${definitionId}'`);
  }
  resolved.add(value);

  if (value instanceof TypeKind.Union) {
    return value.members.map((member) => `(${createMediationTypeText(member, definition, resolved)})`).join(' | ');
  }

  if (Array.isArray(value)) {
    return `[${value.map((value) => createMediationTypeText(value, definition, resolved)).join(', ')}]`;
  }

  const acc: IntermediateTypeAccumulator = {
    solubleSigs: [],
    solubleTypes: [],
    insolubleSigs: [],
    insolubleTypes: [],
    nestedInsolubleSigs: [],
  };

  Object.getOwnPropertyNames(value).forEach((key) => {
    let hasNestedSoluble = false;
    const type = createMediationTypeText(value[key], definition, resolved, () => void (hasNestedSoluble = true));
    const signature = `${key}: ${type};`;
    if (hasNestedSoluble) {
      acc.nestedInsolubleSigs.push(signature);
    } else {
      acc.solubleSigs.push(signature);
    }
  });

  Object.getOwnPropertySymbols(value).forEach((sym) => {
    const fragmentId = getSymbolName(sym);
    const template = fragmentTempaltes.get(fragmentId);
    if (!template) throw new Error(`Fragment Not Found: check around '${fragmentId}'`);

    const rawDependencies: FragmentDependencies = value[sym] || {};
    const dependencies = new Map<string, string>();
    Object.entries(rawDependencies).forEach(([key, value]) => {
      dependencies.set(key, JSON.stringify(value));
    });

    const { solubleSigs, insolubleSigs, solubleTypes, insolubleTypes } = template;
    if (solubleSigs) acc.solubleSigs.push(solubleSigs.serialize(dependencies));
    if (solubleTypes) acc.solubleTypes.push(solubleTypes.serialize(dependencies));
    if (insolubleSigs) acc.insolubleSigs.push(insolubleSigs.serialize(dependencies));
    if (insolubleTypes) acc.insolubleTypes.push(insolubleTypes.serialize(dependencies));
  });

  return finalizeIntermediateType(acc, onNestedSolutionFound);
};

export const finalizeIntermediateType = (
  { solubleSigs, solubleTypes, insolubleSigs, insolubleTypes, nestedInsolubleSigs }: IntermediateTypeAccumulator,
  onNestedSolutionFound: (() => void) | undefined,
) => {
  if (solubleSigs.length) solubleTypes.push(`{${solubleSigs.join('')}}`);
  if (insolubleSigs.length) insolubleTypes.push(`{${insolubleSigs.join('')}}`);

  const result = [];
  if (insolubleTypes.length) {
    result.push(`(/* typeshot.Eval */(${insolubleTypes.join(' & ')}))`);
  }
  if (solubleTypes.length) {
    onNestedSolutionFound?.();
    result.push(`typeshot.Integrate<${solubleTypes.join(' & ')}>`);
  }
  if (nestedInsolubleSigs.length) {
    onNestedSolutionFound?.();
    result.push(`{${nestedInsolubleSigs.join('')}}`);
  }

  return result.join(' & ');
};

export const evaluateMediationTypeNode = (
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
    const isInterfaceLike = isIntegrateType(type) || ts.isTypeLiteralNode(type) || ts.isMappedTypeNode(type);

    const typeFunc = ({ format, name }: TypeInstance) => {
      if (format === 'literal') {
        return literal;
      } else if (format === 'interface' && isInterfaceLike) {
        return `interface ${name} ${literal}`;
      }
      return `type ${name} = ${literal};`;
    };

    return { id, typeFunc };
  }
  throw new Error('');
};

const isIntegrateType = (node: ts.Node) => {
  return ts.isTypeReferenceNode(node) && node.typeName.getText() === 'typeshot.Integrate';
};

export class IntermediateTypeAstTemplate extends AstTemplate<
  ts.TypeNode,
  [checker: ts.TypeChecker, printer: ts.Printer, builderFlags?: ts.NodeBuilderFlags]
> {
  protected getSubstitution(node: ts.Node) {
    if (ts.isTypeReferenceNode(node) && node.typeName.getText() === 'typeshot.Integrate') {
      return node;
    } else if (
      ts.isParenthesizedTypeNode(node) &&
      ts.isParenthesizedTypeNode(node.type) &&
      /^\/\* typeshot\.Eval \*\//.test(node.type.getFullText())
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
const dummyFile = ts.createSourceFile('__dummy__.ts', '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
const defaultBuilderFlags =
  ts.NodeBuilderFlags.InTypeAlias |
  ts.NodeBuilderFlags.NoTruncation |
  ts.NodeBuilderFlags.IgnoreErrors |
  ts.NodeBuilderFlags.GenerateNamesForShadowedTypeParams |
  ts.NodeBuilderFlags.UseAliasDefinedOutsideCurrentScope |
  0;
