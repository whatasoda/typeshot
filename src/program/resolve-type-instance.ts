import { FragmentDependencies, TypeKind, TypeInstance } from '../typeshot';
import { getSymbolName } from '../utils/symbol';
import type { ResolvedTypeDefinition } from './resolve-type-definition';

export const resolveTypeInstance = (instance: TypeInstance, definition: ResolvedTypeDefinition) => {
  return resolvePayload(instance.payload, definition);
};

const resolvePayload = (payload: any, definition: ResolvedTypeDefinition, resolved: Set<any> = new Set()): string => {
  switch (payload) {
    case null:
      return 'null';
    case void 0:
      return 'undefined';
  }

  const { id: definitionId, fragmentTemplates } = definition;
  switch (typeof payload) {
    case 'boolean':
    case 'string':
    case 'number':
      return JSON.stringify(payload);
    case 'object':
      break;
    default:
      throw new TypeError(`Unsupported Value Type '${typeof payload}': check type definition '${definitionId}'`);
  }

  if (resolved.has(payload)) {
    throw new Error(`Unexpected Circular Reference: check type definition '${definitionId}'`);
  }
  resolved.add(payload);

  if (payload instanceof TypeKind.Union) {
    return payload.members.map((member) => `(${resolvePayload(member, definition)})`).join(' | ');
  }

  if (Array.isArray(payload)) {
    return `[${payload.map((value) => resolvePayload(value, definition)).join(', ')}]`;
  }

  const base = Object.getOwnPropertyNames(payload).reduce((acc, key) => {
    return acc + `${key}: ${resolvePayload(payload[key], definition)};`;
  }, '');

  const fragments = Object.getOwnPropertySymbols(payload).map((fragmentSymbol) => {
    const fragmentId = getSymbolName(fragmentSymbol);
    const fragment = fragmentTemplates.get(fragmentId);
    if (!fragment) {
      throw new Error(`Fragment Not Found: check around '${fragmentId}'`);
    }
    const { template, substitutions } = fragment;
    const dependencies: FragmentDependencies = payload[fragmentSymbol] || {};
    return String.raw(
      Object.assign(template, { raw: template }),
      ...substitutions.map((dependencyName) => {
        if (!(dependencyName in dependencies)) {
          throw new Error(`Dependency Not Found: dependency ${dependencyName} is missed at '${fragmentId}'`);
        }
        return JSON.stringify(dependencies[dependencyName]);
      }),
    );
  });

  return fragments.length ? `{${base}} & (${fragments.join(' & ')})` : `{${base}}`;
};
