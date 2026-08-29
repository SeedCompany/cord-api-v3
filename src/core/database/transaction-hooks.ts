import { Injectable } from '@nestjs/common';
import { cached } from '@seedcompany/common';
import { GqlContextHost } from '../graphql';

@Injectable()
export class TransactionHooks {
  private readonly eventsByContext = new WeakMap<
    GqlContextHost['context'],
    Map<string, CallbackManager>
  >();

  constructor(private readonly contextHost: GqlContextHost) {}

  get afterRollback() {
    return this.managerFor('afterRollback');
  }

  get afterCommit() {
    return this.managerFor('afterCommit');
  }

  /**
   * Run `fn` after the current mutation's transaction commits, or immediately
   * when not inside one.
   *
   * Inside a GraphQL mutation the work is queued to {@link afterCommit}, which
   * the TransactionalMutationsInterceptor drains on commit and CLEARS on
   * rollback — so a rolled-back attempt cannot leak its side effects, and a
   * retried attempt cannot re-run them. Outside a mutation nothing drains that
   * queue, so the work runs right away instead of never.
   */
  async afterCommitOrNow(fn: Callback) {
    const op = this.contextHost.contextMaybe?.operation;
    if (op && op.operation === 'mutation') {
      this.afterCommit.add(fn);
      return;
    }
    await fn();
  }

  private managerFor(event: string) {
    const contextId = this.contextHost.context;
    return cached(
      cached(this.eventsByContext, contextId, () => new Map()),
      event,
      () => new CallbackManager(),
    );
  }
}

type Callback = () => Promise<void>;

interface CallbackRef {
  fn: Callback;
  remove: () => void;
}

export class CallbackManager {
  private readonly functions = new Set<Callback>();

  /**
   * Add a function to call.
   */
  add(fn: Callback): CallbackRef {
    const remove = () => this.functions.delete(fn);
    this.functions.add(fn);
    return { fn, remove };
  }

  /**
   * Call all the stored functions and clear the list.
   */
  async runAndClear() {
    const functions = this.functions;
    for (const fn of functions) {
      await fn();
      functions.delete(fn);
    }
  }

  /**
   * Throw the stored functions away without calling them.
   */
  clear() {
    this.functions.clear();
  }
}
