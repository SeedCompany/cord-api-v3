import { InMemoryLiveQueryStore } from '@n1ru4l/in-memory-live-query-store';
import { Injectable } from '@nestjs/common';
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
    this.txHooks.afterCommit.add(async () => {
      await this.store.invalidate(identifiers as string | string[]);
    });
  }
}
