import { InMemoryLiveQueryStore } from '@n1ru4l/in-memory-live-query-store';
import { Injectable } from '@nestjs/common';
import { cached } from '@seedcompany/common';
import { TransactionHooks } from '../database';
import { LiveQueryStore } from './live-query-store.interface';

/**
 * Separated implementation because I imagine the interface will be imported all over,
 * and I don't want to couple those imports to the database & graphql module/folder.
 */
@Injectable()
export class LiveQueryStoreImpl extends LiveQueryStore {
  constructor(
    private readonly store: InMemoryLiveQueryStore,
    private readonly txHooks: TransactionHooks,
  ) {
    super();
  }
  private readonly pendingInvalidations = new WeakMap<object, Set<string>>();

  /**
   * Wait to do invalidation until after the transaction is committed.
   * The store re-runs the queries it determines to be stale inside this
   * async execution, and this needs to be done outside the transaction.
   *
   * We also don't have an easy way to check if this execution is currently in a transaction.
   * It would be nice to confirm this and warn if not.
   * Currently, if this case is hit, it is highly likely the invalidation will just be dropped.
   */
  protected doInvalidate(identifiers: string[]) {
    const { afterCommit } = this.txHooks;
    const idList = cached(this.pendingInvalidations, afterCommit, () => {
      const idList = new Set<string>();
      afterCommit.add(async () => {
        await this.store.invalidate([...idList]);
      });
      return idList;
    });
    for (const id of identifiers) {
      idList.add(id);
    }
  }
}
