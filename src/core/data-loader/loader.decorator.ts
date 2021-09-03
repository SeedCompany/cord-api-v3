import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import * as DataLoader from 'dataloader';
import { Class } from 'type-fest';
import { ID, ServerException } from '../../common';
import { NEST_LOADER_CONTEXT_KEY } from './constants';
import { DataLoaderInterceptor } from './data-loader.interceptor';

/**
 * This interface will be used to generate the initial data loader.
 * The concrete implementation should be added as a provider to your module.
 */
export interface NestDataLoader<T, Key = ID> {
  /**
   * Should return a new instance of dataloader each time
   */
  generateDataLoader: () => DataLoader<Key, T>;
}

/**
 * The decorator to be used within your graphql method.
 */
export const Loader = createParamDecorator(
  (data: Class<any>, context: ExecutionContext) => {
    const name = data?.name;
    if (!name) {
      throw new ServerException(`Invalid name provider to @Loader ('${name}')`);
    }

    if (context.getType<GqlContextType>() !== 'graphql') {
      throw new ServerException(
        '@Loader should only be used within the GraphQL context'
      );
    }

    const ctx = GqlExecutionContext.create(context).getContext();
    if (!name || !ctx[NEST_LOADER_CONTEXT_KEY]) {
      throw new ServerException(
        `You should provide interceptor ${DataLoaderInterceptor.name} globally with ${APP_INTERCEPTOR}`
      );
    }

    return ctx[NEST_LOADER_CONTEXT_KEY].getLoader(name);
  }
);
