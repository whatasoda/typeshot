import { getContext } from '../program/context';
import { TypeDefinitionInfo } from '../program/type-definition';
import { withStackTracking } from '../utils/stack-tracking';
import { createTypeInstanceFactory, TypeInstanceFactory } from './type-instance';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type CreateTypeFragment = <_>(
  deps: FragmentDependencies,
  options?: TypeFragmentInfoInit,
) => Readonly<TypeFragment>;
export type TypeFragment = Record<symbol, FragmentDependencies>;
export type FragmentDependencies = Record<string, any>;
export interface TypeFragmentInfoInit {
  forceIntegrate?: boolean;
}

export const registerTypeDefinition: {
  <T extends any[]>(factory: (createTypeFragment: CreateTypeFragment, ...args: T) => any): {
    (...args: T): TypeInstanceFactory;
  };
} = withStackTracking((definitionStack, factory) => {
  const context = getContext();
  const definitionId = `definition@${definitionStack.composed}`;
  const definitionInfo: TypeDefinitionInfo = {
    id: definitionId,
    stack: definitionStack,
    fragments: new Map(),
  };
  context.definitionInfoMap.set(definitionId, definitionInfo);

  return (...args): TypeInstanceFactory => {
    const { fragments } = definitionInfo;
    const createTypeFragment: CreateTypeFragment = withStackTracking((fragmentStack, dependencies, options = {}) => {
      const fragmentId = `fragment@${fragmentStack.composed}`;
      if (!fragments.has(fragmentId)) {
        fragments.set(fragmentId, { ...options, id: fragmentId, stack: fragmentStack });
      }

      return Object.assign(Object.create(null), { [Symbol(fragmentId)]: dependencies });
    });

    const value = factory(createTypeFragment, ...args);
    return createTypeInstanceFactory(definitionId, value);
  };
});
