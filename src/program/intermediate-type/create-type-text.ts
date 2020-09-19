import { FragmentDependencies } from '../../typeshot/register-type-definition';
import { TypeKind } from '../../typeshot/type-kind';
import { getSymbolName } from '../../utils/converters';
import { EVAL, INTEGRATE } from '../intermediate-type/constants';
import type { TypeDefinition } from '../type-definition';

export const createIntermediateTypeText = (
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

  const { id: definitionId } = definition;
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
  } else {
    resolved.add(value);
  }

  if (value instanceof TypeKind.Union) {
    return value.members.map((member) => `(${createIntermediateTypeText(member, definition, resolved)})`).join(' | ');
  }

  if (Array.isArray(value)) {
    return `[${value.map((value) => createIntermediateTypeText(value, definition, resolved)).join(', ')}]`;
  }

  return finalizeIntermediateTypeText(resolveObjectValue(value, definition, resolved), onNestedSolutionFound);
};

interface IntermediateTypeAccumulator {
  solubleSigs: string[];
  solubleTypes: string[];
  insolubleSigs: string[];
  insolubleTypes: string[];
  nestedInsolubleSigs: string[];
}

const resolveObjectValue = (value: any, definition: TypeDefinition, resolved: Set<any> = new Set()) => {
  const { fragmentTempaltes } = definition;
  const acc: IntermediateTypeAccumulator = {
    solubleSigs: [],
    solubleTypes: [],
    insolubleSigs: [],
    insolubleTypes: [],
    nestedInsolubleSigs: [],
  };

  Object.getOwnPropertyNames(value).forEach((key) => {
    let hasNestedSoluble = false;
    const type = createIntermediateTypeText(value[key], definition, resolved, () => void (hasNestedSoluble = true));
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

  return acc;
};

const finalizeIntermediateTypeText = (
  { solubleSigs, solubleTypes, insolubleSigs, insolubleTypes, nestedInsolubleSigs }: IntermediateTypeAccumulator,
  onNestedSolutionFound: (() => void) | undefined,
) => {
  if (solubleSigs.length) solubleTypes.push(`{${solubleSigs.join('')}}`);
  if (insolubleSigs.length) insolubleTypes.push(`{${insolubleSigs.join('')}}`);

  const result = [];
  if (insolubleTypes.length) {
    result.push(`(${EVAL}(${insolubleTypes.join(' & ')}))`);
  }
  if (solubleTypes.length) {
    onNestedSolutionFound?.();
    result.push(`${INTEGRATE}<${solubleTypes.join(' & ')}>`);
  }
  if (nestedInsolubleSigs.length) {
    onNestedSolutionFound?.();
    result.push(`{${nestedInsolubleSigs.join('')}}`);
  }

  return result.join(' & ');
};
