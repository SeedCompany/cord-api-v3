import { describe, expect, it } from '@jest/globals';
import { type CallHandler, type ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { type GqlContextHost } from '~/core/graphql';
import { TransactionalMutationsInterceptor } from './abstract-transactional-mutations.interceptor';
import { TransactionHooks } from './transaction-hooks';

/**
 * A failed mutation can be retried — Neo4j's driver retries transient errors on
 * its own, and the Postgres arm re-runs the body when a handler asks for it. A
 * retry reuses the same GraphQL context, so it reuses the same callback queues.
 *
 * That makes the failure path responsible for emptying the after-commit queue.
 * If it doesn't, a callback registered by an attempt whose writes were rolled
 * back is still queued when a later attempt commits, and it runs — publishing a
 * notification about a change that never happened.
 *
 * Nothing else covers this. It cannot be reached from an e2e spec without a
 * mutation that fails retryably and then succeeds, so the interceptor is driven
 * directly here with a transaction runner that retries once.
 */

/** Minimal GraphQL mutation context — only what `intercept` reads. */
const mutationContext = () =>
  ({
    getType: () => 'graphql',
    getArgs: () => [
      undefined,
      {},
      {},
      { operation: { operation: 'mutation' } },
    ],
    getClass: () => class FakeResolver {},
    // Never invoked — `intercept` only reads it to build the Gql context.
    getHandler: () => () => undefined,
  }) as unknown as ExecutionContext;

/** The queues are keyed by GraphQL context identity, so any object will do. */
const hooksForOneRequest = () =>
  new TransactionHooks({ context: {} } as unknown as GqlContextHost);

/** Runs the mutation body, and re-runs it once if the first go throws. */
class RetriesOnce extends TransactionalMutationsInterceptor {
  protected async inTx<R>(fn: () => Promise<R>): Promise<R> {
    try {
      return await fn();
    } catch {
      return await fn();
    }
  }
}

/** Never retries — the ordinary single-attempt case. */
class NeverRetries extends TransactionalMutationsInterceptor {
  protected async inTx<R>(fn: () => Promise<R>): Promise<R> {
    return await fn();
  }
}

/**
 * A resolver that registers one after-commit callback per attempt, recording
 * which attempt it belonged to, and fails every attempt before `succeedOn`.
 */
const resolverRegisteringPerAttempt = (
  hooks: TransactionHooks,
  ran: number[],
  succeedOn: number,
): CallHandler => {
  let attempt = 0;
  return {
    handle: () => {
      attempt++;
      const thisAttempt = attempt;
      hooks.afterCommit.add(async () => {
        ran.push(thisAttempt);
      });
      if (thisAttempt < succeedOn) {
        throw new Error(`attempt ${thisAttempt} failed`);
      }
      return of(`committed on attempt ${thisAttempt}`);
    },
  };
};

const run = async (
  interceptor: TransactionalMutationsInterceptor,
  next: CallHandler,
) => await lastValueFrom(await interceptor.intercept(mutationContext(), next));

describe('TransactionalMutationsInterceptor after-commit queue', () => {
  it('drops callbacks from a rolled-back attempt when a later attempt commits', async () => {
    const hooks = hooksForOneRequest();
    const ran: number[] = [];

    const result = await run(
      new RetriesOnce(hooks),
      resolverRegisteringPerAttempt(hooks, ran, 2),
    );

    expect(result).toBe('committed on attempt 2');
    // Attempt 1's writes were rolled back, so its callback must never run.
    expect(ran).toEqual([2]);
  });

  it('still runs the callbacks of an attempt that does commit', async () => {
    // Guards against "fixing" the above by clearing the queue unconditionally,
    // which would silence every broadcast in the app.
    const hooks = hooksForOneRequest();
    const ran: number[] = [];

    await run(
      new NeverRetries(hooks),
      resolverRegisteringPerAttempt(hooks, ran, 1),
    );

    expect(ran).toEqual([1]);
  });

  it('runs nothing when every attempt fails', async () => {
    const hooks = hooksForOneRequest();
    const ran: number[] = [];

    await expect(
      run(
        new RetriesOnce(hooks),
        resolverRegisteringPerAttempt(hooks, ran, 99),
      ),
    ).rejects.toThrow('attempt 2 failed');

    expect(ran).toEqual([]);
  });
});
