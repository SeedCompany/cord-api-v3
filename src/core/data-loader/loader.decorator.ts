import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  GqlExecutionContext,
  GqlContextType as GqlRequestType,
} from '@nestjs/graphql';
// eslint-disable-next-line no-restricted-imports -- the one spot we do want to import it
import * as DataLoaderLib from 'dataloader';
import {
  AbstractClassType,
  GqlContextType,
  ID,
  ServerException,
} from '../../common';
import { NEST_LOADER_CONTEXT_KEY } from './constants';
import { DataLoaderInterceptor } from './data-loader.interceptor';

/**
 * An alias for an actual DataLoader at runtime.
 *
 * The object type is first generic and key generic defaults to ID.
 */
export type DataLoader<T, Key = ID> = DataLoaderLib<Key, T>;

/**
 * This interface will be used to generate the initial data loader.
 * The concrete implementation should be added as a provider to your module.
 */
export interface NestDataLoader<T, Key = ID> {
  /**
   * Should return a new instance of dataloader each time
   */
  generateDataLoader: (context: GqlContextType) => DataLoader<T, Key>;
}

/**
 * The decorator to be used within your graphql method.
 */
export const Loader = createParamDecorator(
  (data: AbstractClassType<any>, context: ExecutionContext) => {
    let name = data?.name;
    if (!name) {
      throw new ServerException(`Invalid name provider to @Loader ('${name}')`);
    }
    name += 'Loader';

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

    return ctx[NEST_LOADER_CONTEXT_KEY].getLoader(name);
  }
);
