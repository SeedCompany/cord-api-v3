import { Injectable, Optional } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { ServerException } from '~/common';
import { ConfigService } from '~/core/config';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { TransactionContext } from '~/core/gel/transaction.context';
import { type TransactionOptions } from '~/core/neo4j/transaction';
import { TransactionRetryInformer } from './transaction-retry.informer';

/**
 * Establishes a database transaction on whichever engine is active.
 *
 * This is the single place that knows how each engine begins a transaction.
 * Everything that needs "run this in a transaction" — the per-engine
 * `TransactionalMutationsInterceptor`s and the `@Transactional()` decorator —
 * delegates here, so no caller has to hardcode an engine.
 *
 * The engine services are injected `@Optional()` because only the active
 * engine's is guaranteed to be resolvable.
 *
 * migration-todo: at Phase 7 cutover, drop the `neo4j` and `gel` arms (and
 * their injections) leaving only the Drizzle path.
 */
@Injectable()
export class TransactionRunner {
  constructor(
    private readonly config: ConfigService,
    private readonly retryInformer: TransactionRetryInformer,
    @Optional() private readonly neo4j?: Connection,
    @Optional() private readonly drizzle?: DrizzleService,
    @Optional() private readonly gel?: TransactionContext,
  ) {}

  /**
   * @param options Neo4j-only transaction options (metadata, retry config).
   *   Ignored by the other engines, which take no equivalent.
   */
  async inTx<R>(
    fn: () => Promise<R>,
    options?: TransactionOptions,
  ): Promise<R> {
    switch (this.config.databaseEngine) {
      case 'postgres':
        return await this.inDrizzleTx(fn);
      case 'gel':
        return await this.required(this.gel, 'gel').inTx(fn);
      case 'neo4j':
        return await this.required(this.neo4j, 'neo4j').runInTransaction(
          fn,
          options,
        );
      default:
        throw new ServerException(
          `Cannot start a transaction for unknown database engine '${this.config.databaseEngine}'`,
        );
    }
  }

  /**
   * Honor {@link TransactionRetryInformer} the way the Neo4j driver does:
   * handlers mark an error retryable and expect the whole unit to re-run.
   * Without this loop `markForRetry()` would be a no-op under Postgres.
   * Same semantics as Neo4j retryable transactions — the body may run more
   * than once, so it must be idempotent.
   */
  private async inDrizzleTx<R>(fn: () => Promise<R>): Promise<R> {
    const drizzle = this.required(this.drizzle, 'postgres');
    let attemptsLeft = 3;
    // eslint-disable-next-line no-constant-condition,@typescript-eslint/no-unnecessary-condition
    while (true) {
      attemptsLeft--;
      try {
        return await drizzle.inTx(fn);
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

  private required<T>(service: T | undefined, engine: string): T {
    if (!service) {
      throw new ServerException(
        `Database engine is '${engine}' but its transaction service is not available`,
      );
    }
    return service;
  }
}
