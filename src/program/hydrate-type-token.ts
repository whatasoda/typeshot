import type { TypeDependencies, TypeToken } from '../registerTypeDefinition';
import { ParameterKind } from '../typeshot';
import { getSymbolName } from '../utils/symbol';
import type { ResolvedTypeDefinition } from './resolve-type-definition';

export const hydrateTypeToken = (token: TypeToken, typeDefinitionMap: Map<string, ResolvedTypeDefinition>) => {
  const { definitionId, payload } = token;
  const definition = typeDefinitionMap.get(definitionId);
  if (!definition) throw new Error(`Type Definition Not Found: type definition '${definitionId}' is not found`);

  return resolvePayload(payload, definition);
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

  if (payload instanceof ParameterKind.Union) {
    return payload.param.map((member) => `(${resolvePayload(member, definition)})`).join(' | ');
  }
  if (payload instanceof ParameterKind.Intersection) {
    return payload.param.map((member) => `(${resolvePayload(member, definition)})`).join(' & ');
  }

  if (Array.isArray(payload)) {
    return `[${payload.map((value) => resolvePayload(value, definition)).join(', ')}]`;
  }

  const baseProperties = Object.getOwnPropertyNames(payload).reduce((acc, key) => {
    return acc + `${key}: ${resolvePayload(payload[key], definition)};`;
  }, '');

  const hydratedFragments = Object.getOwnPropertySymbols(payload).map((fragmentSymbol) => {
    const fragmentId = getSymbolName(fragmentSymbol);
    const fragment = fragmentTemplates[fragmentId];
    if (!fragment) {
      throw new Error(`Fragment Not Found: check around '${fragmentId}'`);
    }
    const { template, substitutions } = fragment;
    const dependencies: TypeDependencies = payload[fragmentSymbol] || {};
    return String.raw(
      Object.assign(template, { raw: template }),
      ...substitutions.map((depName) => {
        if (!(depName in dependencies)) {
          throw new Error(`Dependency Not Found: dependency ${depName} is missed at '${fragmentId}'`);
        }
        return JSON.stringify(dependencies[depName]);
      }),
    );
  });

  return `{${baseProperties}} & (${hydratedFragments})`;
};
