import { Injectable } from '@nestjs/common';
import type { Nil } from '@seedcompany/common';

/**
 * A service used to allow the codebase to inform the database transactions
 * that a certain error should be retried (or not) regardless of defaults.
 *
 * Currently, it is expected that only database errors are marked & checked.
 * But this limitation could be lifted in the future if needed.
 */
@Injectable()
export class TransactionRetryInformer {
  private readonly errors = new WeakMap<Error, boolean>();

  /**
   * Inform the transaction that this error should be retried (or not),
   * regardless of what the defaults are.
   *
   * The driver config still informs the number of retries & the delay.
   */
  markForRetry(error: Error, retry = true) {
    this.errors.set(error, retry);
  }

  /**
   * Check whether the error has been overridden to retry or not.
   *
   * @internal
   */
  shouldRetry(error: Error): boolean | Nil {
    return this.errors.get(error);
  }
}
