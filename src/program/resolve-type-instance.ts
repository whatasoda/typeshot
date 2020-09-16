import { FragmentDependencies, TypeKind, TypeInstance } from '../typeshot';
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

const resolveInstancePayload = (value: any, definition: TypeDefinition, resolved: Set<any> = new Set()): string => {
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
    return value.members.map((member) => `(${resolveInstancePayload(member, definition)})`).join(' | ');
  }

  if (Array.isArray(value)) {
    return `[${value.map((value) => resolveInstancePayload(value, definition)).join(', ')}]`;
  }

  const fromValue = Object.getOwnPropertyNames(value).reduce((acc, key) => {
    return acc + `${key}: ${resolveInstancePayload(value[key], definition)};`;
  }, '');
  const fromFragment = Object.getOwnPropertySymbols(value).map((sym) => {
    const fragmentId = getSymbolName(sym);
    const fragment = fragments.get(fragmentId);
    if (!fragment) {
      throw new Error(`Fragment Not Found: check around '${fragmentId}'`);
    }
    const { templateStrings, substitutions } = fragment;
    const dependencies: FragmentDependencies = value[sym] || {};
    return String.raw(
      templateStrings,
      ...substitutions.map((dependencyName) => {
        if (!(dependencyName in dependencies)) {
          throw new Error(`Dependency Not Found: dependency ${dependencyName} is missed at '${fragmentId}'`);
        }
        return JSON.stringify(dependencies[dependencyName]);
      }),
    );
  });

  // TODO: refactor
  const rawResult = fromFragment.length ? `{${fromValue}} & (${fromFragment.join(' & ')})` : `{${fromValue}}`;
  return `typeshot.Expand<${rawResult}>`;
};
