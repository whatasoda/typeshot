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
  definition.intermediateTypes.set(instance, resolveInstancePayload(value, definition));
};

const resolveInstancePayload = (
  value: any,
  definition: TypeDefinition,
  resolved: Set<any> = new Set(),
  onIntegration?: () => void,
): string => {
  switch (value) {
    case null:
      return 'null';
    case void 0:
      return 'undefined';
  }

  const { id: definitionId, fragments } = definition;
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
    return value.members.map((member) => `(${resolveInstancePayload(member, definition, resolved)})`).join(' | ');
  }

  if (Array.isArray(value)) {
    return `[${value.map((value) => resolveInstancePayload(value, definition, resolved)).join(', ')}]`;
  }

  const crossableTypes: string[] = [];
  const exceptionalTypes: string[] = [];
  const crossableSignatures: string[] = [];
  const exceptionalSignatures: string[] = [];
  const childSpectialSignatures: string[] = [];

  Object.getOwnPropertyNames(value).forEach((key) => {
    let hasIntegration = false;
    const type = resolveInstancePayload(value[key], definition, resolved, () => void (hasIntegration = true));
    const signature = `${key}: ${type};`;
    if (hasIntegration) {
      onIntegration?.();
      childSpectialSignatures.push(signature);
    } else {
      crossableSignatures.push(signature);
    }
  });

  Object.getOwnPropertySymbols(value).forEach((sym) => {
    const fragmentId = getSymbolName(sym);
    const fragment = fragments.get(fragmentId);
    if (!fragment) {
      throw new Error(`Fragment Not Found: check around '${fragmentId}'`);
    }

    const dependencies: FragmentDependencies = value[sym] || {};
    if (fragment.crossableSignatures) {
      crossableSignatures.push(fragment.crossableSignatures.serialize(dependencies));
    }
    if (fragment.exceptionalSignatures) {
      exceptionalSignatures.push(fragment.exceptionalSignatures.serialize(dependencies));
    }
    if (fragment.crossableTypes) {
      crossableTypes.push(fragment.crossableTypes.serialize(dependencies));
    }
    if (fragment.exceptionalTypes) {
      exceptionalTypes.push(fragment.exceptionalTypes.serialize(dependencies));
    }
  });

  if (crossableSignatures.length) crossableTypes.push(`{${crossableSignatures.join('')}}`);
  if (exceptionalSignatures.length) exceptionalTypes.push(`{${exceptionalSignatures.join('')}}`);

  const result = [];
  if (crossableTypes.length) {
    onIntegration?.();
    result.push(`typeshot.Integrate<${crossableTypes.join(' & ')}>`);
  }
  if (exceptionalTypes.length) {
    result.push(`(/* typeshot.Eval */(${exceptionalTypes.join(' & ')}))`);
  }
  if (childSpectialSignatures.length) {
    result.push(`{${childSpectialSignatures.join('')}}`);
  }

  return result.join(' & ');
};

const defaultBuilderFlags =
  ts.NodeBuilderFlags.InTypeAlias |
  ts.NodeBuilderFlags.NoTruncation |
  ts.NodeBuilderFlags.IgnoreErrors |
  ts.NodeBuilderFlags.GenerateNamesForShadowedTypeParams |
  ts.NodeBuilderFlags.UseAliasDefinedOutsideCurrentScope |
  0;
export const resolveIntermediateTypeInstance = (
  member: ts.TypeElement,
  sourceText: string,
  checker: ts.TypeChecker,
  printer: ts.Printer,
  builderFlags: ts.NodeBuilderFlags = defaultBuilderFlags,
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

const dummyFile = ts.createSourceFile('__dummy__.ts', '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
export class IntermediateTypeAstTemplate extends AstTemplate<
  ts.TypeNode,
  [checker: ts.TypeChecker, printer: ts.Printer, builderFlags: ts.NodeBuilderFlags]
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
    builderFlags: ts.NodeBuilderFlags,
  ) {
    const type = checker.getTypeFromTypeNode(node);
    const resolvedType = checker.typeToTypeNode(type, undefined, builderFlags);
    if (!resolvedType) throw new Error('');
    return printer.printNode(ts.EmitHint.Unspecified, resolvedType, dummyFile);
  }
}
