import { Injectable } from '@nestjs/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { TransactionRetryInformer } from './transaction-retry.informer';

/**
 * Establishes a database transaction.
 *
 * Everything that needs "run this in a transaction" — the
 * `TransactionalMutationsInterceptor` and the `@Transactional()` decorator —
 * delegates here.
 */
@Injectable()
export class TransactionRunner {
  constructor(
    private readonly retryInformer: TransactionRetryInformer,
    private readonly drizzle: DrizzleService,
  ) {}

  async inTx<R>(fn: () => Promise<R>): Promise<R> {
    // Already inside a transaction: continue in it, and deliberately return
    // BEFORE the retry loop below rather than relying on inTx to continue.
    // Entering the loop while nested would multiply the retry budget — the
    // outer unit's three attempts times this one's — so one markForRetry()
    // could re-run the body, and every hook it fires, up to nine times.
    // Keep one retry scope per mutation.
    if (this.drizzle.inTransaction) {
      return await fn();
    }
    return await this.inDrizzleTx(fn);
  }

  /**
   * Honor {@link TransactionRetryInformer}: handlers mark an error retryable
   * and expect the whole unit to re-run. The body may run more than once, so
   * it must be idempotent.
   */
  private async inDrizzleTx<R>(fn: () => Promise<R>): Promise<R> {
    let attemptsLeft = 3;
    // eslint-disable-next-line no-constant-condition,@typescript-eslint/no-unnecessary-condition
    while (true) {
      attemptsLeft--;
      try {
        return await this.drizzle.inTx(fn);
      } catch (error) {
        if (attemptsLeft > 0 && this.markedForRetry(error)) {
          continue;
        }
        throw error;
      }
    }
  }

  private markedForRetry(error: unknown): boolean {
    // The marked error is usually a cause of the thrown one (handlers wrap the
    // db error in a ServerException) — walk the chain.
    let current = error;
    while (current instanceof Error) {
      if (this.retryInformer.shouldRetry(current)) return true;
      current = current.cause;
    }
    return false;
  }
}
