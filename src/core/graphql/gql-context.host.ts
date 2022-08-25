import { Plugin } from '@nestjs/apollo';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NestMiddleware,
  OnModuleDestroy,
} from '@nestjs/common';
import { GqlContextType as ContextKey } from '@nestjs/graphql';
import {
  ApolloServerPlugin as ApolloPlugin,
  GraphQLRequestListener as RequestListener,
} from 'apollo-server-plugin-base';
import { GraphQLRequestContext as RequestContext } from 'apollo-server-types';
import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response } from 'express';
import { GqlContextType as ContextType, GqlContextType } from '../../common';
import { AsyncLocalStorageNoContextException } from '../async-local-storage-no-context.exception';

/**
 * A service holding the current GraphQL context
 */
export abstract class GqlContextHost {
  /**
   * The current GraphQL context
   */
  readonly context: GqlContextType;
}

/**
 * This is necessary to allow global pipes to have access to GraphQL request context.
 * At least until this is resolved: https://github.com/nestjs/graphql/issues/325
 */
@Injectable()
@Plugin()
export class GqlContextHostImpl
  implements
    GqlContextHost,
    NestMiddleware,
    NestInterceptor,
    OnModuleDestroy,
    ApolloPlugin<ContextType>
{
  als = new AsyncLocalStorage<{
    ctx?: GqlContextType;
    execution?: ExecutionContext;
  }>();

  /**
   * Unwrap the ALS store or throw error if called incorrectly.
   */
  get context() {
    const store = this.als.getStore();
    if (store?.ctx) {
      return store.ctx;
    }

    const message = 'The GraphQL context is not available yet.';
    if (!store) {
      throw new AsyncLocalStorageNoContextException(message);
    }
    if (
      !store.ctx &&
      store.execution &&
      store.execution.getType<ContextKey>() !== 'graphql'
    ) {
      throw new NotGraphQLContext(message);
    }
    throw new Error(message);
  }

  use = (req: Request, res: Response, next: () => void) => {
    // Connect middleware is the only place we get a function where we can
    // completely wrap the request for the use of an ALS context.
    this.attachScope(next);
  };

  attachScope<R>(fn: () => R): R {
    // Just give it a placeholder object for now which we populate below.
    return this.als.run({}, fn);
  }

  intercept(context: ExecutionContext, next: CallHandler) {
    const store = this.als.getStore();
    if (store) {
      store.execution = context;
    }

    return next.handle();
  }

  /**
   * Attach GQL context to the ALS store now that we have it.
   */
  async requestDidStart({
    context,
  }: RequestContext<ContextType>): Promise<RequestListener<ContextType>> {
    const store = this.als.getStore();
    if (!store) {
      return {};
    }
    store.ctx = context;
    return {
      async didResolveOperation({ operation }) {
        context.operation = operation;
      },
    };
  }

  onModuleDestroy() {
    this.als.disable();
  }
}

export class NotGraphQLContext extends Error {}
