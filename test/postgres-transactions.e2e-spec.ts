import { beforeAll, describe, expect, it } from '@jest/globals';
import { sql } from 'drizzle-orm';
import { DrizzleService } from '~/core/drizzle';
import { createTestApp, type TestApp } from './utility';

// Transaction scoping is engine-specific, so these only mean anything under
// DATABASE=postgres. Reported as skipped under neo4j rather than passing while
// asserting nothing.
// migration-todo: drop the engine check at Phase 7 cutover (always postgres).
const isPostgres = process.env.DATABASE === 'postgres';
const describePg = isPostgres ? describe : describe.skip;

/**
 * A nested transaction must CONTINUE the one already open, not begin a second.
 *
 * Nothing else in the suite can tell those two apart, which is how the second
 * behaviour shipped unnoticed: a mutation that succeeds end to end looks the
 * same either way, and a mutation that fails inside the innermost call rolls
 * back either way. The difference only shows when the OUTER unit fails after the
 * inner one finished — then an independent inner transaction has already
 * committed and its write survives a rollback that was supposed to undo it.
 *
 * The concurrency symptom is worse than the correctness one, and equally
 * invisible here: each nested call holds a second pool connection for as long as
 * the outer one lives, so enough concurrent requests leave every connection
 * waiting on a connection that only frees when those same requests finish. The
 * e2e suite runs with a single worker, so it can never produce that.
 */
describePg('Postgres transaction scoping', () => {
  let app: TestApp;
  let drizzle: DrizzleService;

  beforeAll(async () => {
    app = await createTestApp();
    drizzle = app.get(DrizzleService);
    // Own scratch table: the assertions are about transaction boundaries, so
    // they should not depend on any domain's schema or triggers. Safe to create
    // because every spec file gets its own ephemeral database.
    await drizzle.client.execute(
      sql`create table tx_probe (id text primary key)`,
    );
  });

  const backendPid = async () => {
    const result = await drizzle.client.execute(
      sql`select pg_backend_pid() as pid`,
    );
    const [row] = result.rows as Array<{ pid: number }>;
    return Number(row!.pid);
  };

  const probeIds = async () => {
    const result = await drizzle.client.execute(sql`select id from tx_probe`);
    return (result.rows as Array<{ id: string }>)
      .map((row) => row.id)
      .sort((left, right) => left.localeCompare(right));
  };

  it('runs a nested transaction on the same connection as its caller', async () => {
    // Same backend process id means one connection, so one transaction. A
    // second, independent transaction necessarily comes from another pool
    // connection and reports a different pid.
    let outerPid: number | undefined;
    let innerPid: number | undefined;

    await drizzle.inTx(async () => {
      outerPid = await backendPid();
      await drizzle.inTx(async () => {
        innerPid = await backendPid();
      });
    });

    expect(outerPid).toBeDefined();
    expect(innerPid).toBe(outerPid);
  });

  it('sees the outer uncommitted write from inside a nested transaction', async () => {
    // A separate transaction could not read this row — it is uncommitted, and
    // Postgres defaults to READ COMMITTED.
    let seenFromNested: string[] = [];

    await drizzle
      .inTx(async () => {
        await drizzle.client.execute(
          sql`insert into tx_probe (id) values ('outer-visible')`,
        );
        await drizzle.inTx(async () => {
          seenFromNested = await probeIds();
        });
        throw new Error('rollback so this test leaves nothing behind');
      })
      .catch(() => undefined);

    expect(seenFromNested).toEqual(['outer-visible']);
    expect(await probeIds()).toEqual([]);
  });

  it('rolls back a nested write when the outer transaction fails afterwards', async () => {
    // The case that matters and the one no existing spec covers: the inner call
    // completes, THEN the outer unit throws. With two independent transactions
    // the inner row is already committed and survives.
    await expect(
      drizzle.inTx(async () => {
        await drizzle.client.execute(
          sql`insert into tx_probe (id) values ('outer')`,
        );
        await drizzle.inTx(async () => {
          await drizzle.client.execute(
            sql`insert into tx_probe (id) values ('inner')`,
          );
        });
        throw new Error('outer fails after the nested write completed');
      }),
    ).rejects.toThrow('outer fails after the nested write completed');

    expect(await probeIds()).toEqual([]);
  });

  /**
   * Work started inside a transaction but not awaited keeps seeing the
   * transaction's async context after it has settled and its pool connection has
   * been handed back. Both entry points must say so rather than letting the
   * query fail somewhere unrelated with "Cannot use a released client".
   *
   * Built with an explicit gate rather than a timer: the continuation has to be
   * registered INSIDE the transaction, so it inherits the context, but must not
   * run until the transaction has finished. A timer cannot promise that ordering,
   * since committing is itself a round trip.
   */
  const escapedWork = async (work: () => Promise<unknown>) => {
    let release: (() => void) | undefined;
    let detached: Promise<unknown> | undefined;

    await drizzle.inTx(async () => {
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      detached = gate.then(work);
    });

    release!(); // only now — the transaction is already settled
    return await detached!;
  };

  it('refuses a query from work that outlived its transaction', async () => {
    await expect(escapedWork(() => probeIds())).rejects.toThrow(
      /escaped its transaction/,
    );
  });

  it('refuses a nested transaction from work that outlived its transaction', async () => {
    await expect(
      escapedWork(async () => await drizzle.inTx(async () => await probeIds())),
    ).rejects.toThrow(/escaped its transaction/);
  });
});
