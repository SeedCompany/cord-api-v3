import { createParamDecorator, ExecutionContext, Type } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  GqlExecutionContext,
  GqlContextType as GqlRequestType,
} from '@nestjs/graphql';
// eslint-disable-next-line no-restricted-imports -- the one spot we do want to import it
import * as DataLoaderLib from 'dataloader';
import { GqlContextType, ID, ServerException } from '../../common';
import { NEST_LOADER_CONTEXT_KEY } from './constants';
import { DataLoaderInterceptor } from './data-loader.interceptor';

/**
 * An alias for an actual DataLoader at runtime.
 *
 * The object type is first generic and key generic defaults to ID.
 */
export type DataLoader<T, Key = ID, CachedKey = Key> = DataLoaderLib<
  Key,
  T,
  CachedKey
> & {
  /**
   * Shortcut for {@link prime}.
   */
  primeAll: (items: readonly T[]) => DataLoader<T, Key, CachedKey>;
};

/**
 * An actual DataLoader for the given loader factory
 */
export type LoaderOf<Factory> = Factory extends NestDataLoader<
  infer T,
  infer Key,
  infer CachedKey
>
  ? DataLoader<T, Key, CachedKey>
  : never;

/**
 * This interface will be used to generate the initial data loader.
 * The concrete implementation should be added as a provider to your module.
 */
export interface NestDataLoader<T, Key = ID, CachedKey = Key> {
  /**
   * Should return a new instance of dataloader each time
   */
  generateDataLoader: (
    context: GqlContextType
  ) => DataLoader<T, Key, CachedKey>;
}

type LoaderType = Type<NestDataLoader<any, any>>;
type LoaderTypeOrFn = LoaderType | (() => LoaderType);

/**
 * The decorator to be used within your graphql method.
 */
export const Loader =
  (type: LoaderTypeOrFn): ParameterDecorator =>
  (target, key, index) => {
    if (!type) {
      const source = `${target.constructor.name}.${String(key)}[${index}]`;
      throw new ServerException(
        `@Loader for ${source} failed to reference loader class. Try wrapping the loader class in \`() => Type\`.`
      );
    }

    LoaderInner(type)(target, key, index);
  };

export const LoaderInner = createParamDecorator(
  (type: LoaderTypeOrFn, context: ExecutionContext) => {
    if (context.getType<GqlRequestType>() !== 'graphql') {
      throw new ServerException(
        '@Loader should only be used within the GraphQL context'
      );
    }

    const ctx = GqlExecutionContext.create(context).getContext();
    if (!ctx[NEST_LOADER_CONTEXT_KEY]) {
      throw new ServerException(
        `You should provide interceptor ${DataLoaderInterceptor.name} globally with ${APP_INTERCEPTOR}`
      );
    }

    const resolvedType = type.prototype
      ? (type as LoaderType)
      : (type as () => LoaderType)();
    return ctx[NEST_LOADER_CONTEXT_KEY].getLoader(resolvedType);
  }
);
