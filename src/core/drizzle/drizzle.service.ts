import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { ConfigService } from '~/core/config';
import * as schema from './schema/index';

// Amazon's RDS certs are issued by AWS's own CA, which isn't in Node's default
// trust store. `sslmode=require` in POSTGRES_URL only gets pg to attempt full
// verification — it still needs this bundle to actually pass. `no-verify`
// (local/PG-test, connecting through an SSM tunnel) skips this entirely.
const rdsCaBundle = readFileSync(
  join(import.meta.dirname, 'rds-ca-bundle.pem'),
  'utf8',
);

export type DrizzleDb = NodePgDatabase<typeof schema>;

/**
 * The transaction in effect for one async context, plus whether it is still
 * usable.
 *
 * The flag is the point. An async context that was created inside a transaction
 * keeps seeing this store after the transaction has settled and its pool
 * connection has been handed back, so "the store is set" does not mean "there is
 * a transaction to use". Recording liveness lets that be reported as the mistake
 * it is instead of surfacing as pg's "Cannot use a released client" from
 * somewhere unrelated.
 */
interface TransactionScope {
  db: DrizzleDb;
  alive: boolean;
}

/** Shared by both callers that find a settled transaction in the store. */
const outlivedTransaction = () =>
  new Error(
    'Database work escaped its transaction: the transaction it was started in has already finished. ' +
      'Work started inside a transaction must be awaited before that transaction ends. ' +
      'To run something after a transaction commits, register a TransactionHooks.afterCommit callback instead.',
  );

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  private readonly baseDb: DrizzleDb;
  private readonly als = new AsyncLocalStorage<TransactionScope>();
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const url = config.postgres.url;
    if (!url) {
      if (config.databaseEngine === 'postgres') {
        throw new Error('POSTGRES_URL is required when DATABASE=postgres');
      }
      return;
    }
    // pg re-parses `connectionString` itself, and if it finds `sslmode` in the
    // query string, the `ssl` it derives from that (not this one) wins — silently
    // dropping our CA. Strip it so our own `ssl` below is what's actually used.
    const parsedUrl = new URL(url);
    const noVerify = parsedUrl.searchParams.get('sslmode') === 'no-verify';
    parsedUrl.searchParams.delete('sslmode');
    this.pool = new Pool({
      connectionString: parsedUrl.toString(),
      ssl: noVerify ? { rejectUnauthorized: false } : { ca: rdsCaBundle },
      // Names every connection this process opens, so `pg_stat_activity` says
      // who is attached instead of listing anonymous backends. The process id
      // is part of it deliberately: the whole pool shares one name, which lets
      // a caller subtract its OWN connections and still see a second API or a
      // stray psql. checkExclusiveTarget in cutover/target-access.ts relies on
      // exactly that, and degrades to a less precise check without it.
      // eslint-disable-next-line @typescript-eslint/naming-convention -- pg's own option name
      application_name: `cord-${config.isCli ? 'cli' : 'api'}[${process.pid}]`,
    });
    this.baseDb = drizzle(this.pool, { schema });
  }

  get client(): DrizzleDb {
    const scope = this.als.getStore();
    if (scope) {
      // Reached only by work that outlived the transaction it started in; see
      // TransactionScope. Throwing here is the whole point — returning the
      // settled transaction gives a released-client error from wherever the
      // query happens to be, and falling back to the pool would be worse still,
      // quietly running outside the transaction the caller believes it is in.
      if (!scope.alive) throw outlivedTransaction();
      return scope.db;
    }
    if (!this.baseDb)
      throw new Error(
        'DrizzleService.client accessed but DATABASE is not postgres',
      );
    return this.baseDb;
  }

  /**
   * Whether this async context is already running inside a transaction.
   *
   * Callers that decide whether to open one need this: nothing about a Drizzle
   * client tells you which of the two it is, since {@link client} silently
   * falls back to the pool.
   */
  get inTransaction(): boolean {
    return this.als.getStore()?.alive === true;
  }

  /**
   * Run `fn` inside a transaction, continuing one that is already open rather
   * than starting a second.
   *
   * The continuation is not a nicety. Without it a nested call takes ANOTHER
   * connection out of the pool and begins a transaction that commits and rolls
   * back independently — so an inner write survives an outer rollback, and each
   * nested call holds two pool connections at once, which deadlocks the pool
   * under concurrency rather than failing. Neo4j's equivalent has always
   * continued (`runInTransaction` returns the inner call directly when a
   * transaction is open), so this also keeps the engines behaving the same.
   *
   * **If you actually want an inner failure to stay isolated**, do not reach for
   * a second `inTx` — call `.transaction()` on the current client, which Drizzle
   * emits as a savepoint on the same connection. `PartnershipDrizzleRepository`
   * does exactly that so losing a uniqueness race cannot poison the surrounding
   * mutation. Continuation here and savepoints there are the two halves of the
   * same design: joined by default, isolated only where asked for.
   *
   * ⚠️ Do not start database work inside a transaction without awaiting it. The
   * store is scoped to the awaited call chain, so unawaited work can outlive the
   * transaction: the callback returns, the transaction commits and its pool
   * client is released, and only then does the stray work call this and find the
   * store still set — now naming a released client. Before continuation existed
   * that shape silently ran in a transaction of its own, which was already the
   * wrong transaction; now it fails loudly instead, which is the better of the
   * two but still a bug at the call site. No current caller does this.
   */
  async inTx<R>(fn: () => Promise<R>): Promise<R> {
    const current = this.als.getStore();
    if (current) {
      if (!current.alive) throw outlivedTransaction();
      return await fn();
    }

    let scope: TransactionScope | undefined;
    try {
      return await this.baseDb.transaction((tx) => {
        scope = { db: tx as DrizzleDb, alive: true };
        return this.als.run(scope, fn);
      });
    } finally {
      // Settled either way — committed or rolled back — so the transaction is no
      // longer usable even though contexts created inside it still see it.
      if (scope) scope.alive = false;
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
