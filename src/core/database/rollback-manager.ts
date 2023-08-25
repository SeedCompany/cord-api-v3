import { Injectable } from '@nestjs/common';
import { GqlContextHost } from '../graphql';

type RollbackFn = () => Promise<void>;

interface RollbackRef {
  fn: RollbackFn;
  remove: () => void;
}

@Injectable()
export class RollbackManager {
  private readonly functionsByContext = new WeakMap<
    GqlContextHost['context'],
    Set<RollbackFn>
  >();

  constructor(private readonly contextHost: GqlContextHost) {}

  /**
   * Add a function to call whenever a rollback is triggered.
   */
  add(fn: RollbackFn): RollbackRef {
    const remove = () => this.functions.delete(fn);
    this.functions.add(fn);
    return { fn, remove };
  }

  /**
   * Call all the stored rollback functions, and clear the list.
   */
  async runAndClear() {
    const functions = this.functions;
    for (const fn of functions) {
      await fn();
      functions.delete(fn);
    }
  }

  private get functions() {
    const contextId = this.contextHost.context;
    if (!this.functionsByContext.has(contextId)) {
      this.functionsByContext.set(contextId, new Set());
    }
    return this.functionsByContext.get(contextId)!;
  }
}
