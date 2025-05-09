import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { isObjectLike } from '@seedcompany/common';
import { AsyncLocalStorage } from 'async_hooks';
import { type GqlContextType as ContextType } from '~/common';
import { AsyncLocalStorageNoContextException } from '../async-local-storage-no-context.exception';
import { Plugin } from './plugin.decorator';

export const ifGqlContext = (object: unknown): ContextType | undefined =>
  isGqlContext(object) ? object : undefined;
export const isGqlContext = (object: unknown): object is ContextType =>
  isObjectLike(object) && isGqlContext.KEY in object;
isGqlContext.KEY = Symbol('GqlContext');

/**
 * A service holding the current GraphQL context
 */
export abstract class GqlContextHost {
  /**
   * The current GraphQL context
   */
  readonly context: ContextType;

  /**
   * The current GraphQL context
   */
  readonly contextMaybe: ContextType | undefined;
}

@Injectable()
@Plugin()
export class GqlContextHostImpl implements GqlContextHost, OnModuleDestroy {
  als = new AsyncLocalStorage<ContextType>();

  get contextMaybe() {
    return this.als.getStore();
  }

  get context() {
    const context = this.als.getStore();
    if (context) {
      return context;
    }
    throw new AsyncLocalStorageNoContextException(
      'The GraphQL context is not available yet.',
    );
  }

  onExecute: Plugin['onExecute'] = ({ executeFn, setExecuteFn, args }) => {
    const ctx = args.contextValue;
    setExecuteFn((...args) => {
      return this.als.run(ctx, executeFn, ...args);
    });
  };

  onModuleDestroy() {
    this.als.disable();
  }
}
