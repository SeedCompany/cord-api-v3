import { Injectable, type OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { ConfigService } from '~/core/config';
import { ILogger, Logger } from '~/core/logger';
import { DrizzleService } from './drizzle.service';

/** `when` of 0000_genesis — what a database built from the genesis file records. */
const GENESIS_WHEN = 1745625600000;
/**
 * `when` of the retired 0042, and so the high-water mark of any database that
 * ran the old 0000-0042 sequence to completion.
 */
const RETIRED_SEQUENCE_END = 1754265600000;

@Injectable()
export class DrizzleMigrator implements OnModuleInit {
  @Logger('postgres:migrator') private readonly logger: ILogger;

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    if (this.config.databaseEngine !== 'postgres') return;
    if (!this.config.pgAutoMigrate) {
      this.logger.info(
        'Skipping migrations — the API is in read-only maintenance mode',
      );
      return;
    }
    await this.run();
  }

  /** Apply all pending Drizzle migrations. Safe to call repeatedly. */
  async run() {
    this.logger.info('Running PostgreSQL migrations');
    await this.assertNotStrandedMidRetiredSequence();
    // NOTE: our migrations are hand-written, but drizzle's migrator only runs
    // files listed in `migrations/meta/_journal.json`. Adding a .sql file
    // without a matching journal entry silently applies nothing — add both.
    //
    // NOTE: drizzle decides what to skip by TIMESTAMP, never by file hash — it
    // reads the single highest `created_at` from `drizzle.__drizzle_migrations`
    // and runs every journal entry whose `when` exceeds it. Two consequences:
    //   - Editing an applied migration's SQL is invisible; it will never re-run.
    //   - A new entry needs a `when` later than the highest one already applied
    //     (1754265600000, old 0042's) or existing databases skip it silently
    //     while fresh ones apply it. See 0000_genesis.sql.
    await migrate(this.drizzle.client, {
      migrationsFolder: path.join(process.cwd(), 'src/core/drizzle/migrations'),
    });
    this.logger.info('PostgreSQL migrations complete');
  }

  /**
   * Refuse to boot a database left part-way through the retired 0000-0042
   * sequence, which the genesis squash made unrecoverable.
   *
   * Such a database's high-water mark sits above genesis's `when`, so drizzle
   * skips the genesis file — and the individual files it still needs no longer
   * exist. `migrate()` would apply nothing, succeed, and let the app boot onto
   * a half-built schema, surfacing later as confusing missing-column errors.
   * Failing here names the real problem instead.
   *
   * Both boundaries are deliberately exclusive: a database that finished the
   * old sequence records exactly `RETIRED_SEQUENCE_END`, and one built from
   * genesis records exactly `GENESIS_WHEN`. Only the strict interior is
   * stranded by timestamp alone.
   *
   * `GENESIS_WHEN` is the one ambiguous value: the retired `0000` carried the
   * same `when`, so a database that applied it and then failed on `0001` is
   * indistinguishable from a genesis-built one by timestamp. That is not an
   * exotic state — drizzle records each migration as it succeeds, so any run
   * that died on the second file lands there. Timestamps cannot separate them,
   * so we ask the schema instead: `public.projects` exists in genesis and not in
   * the retired `0000`, whose five tables were all auth.
   *
   * migration-todo: delete this guard once no environment can predate the
   * squash — it protects only against databases built before 2026-09-08.
   */
  private async assertNotStrandedMidRetiredSequence() {
    const db = this.drizzle.client;

    // The bookkeeping table does not exist yet on a brand-new database, and a
    // reference to a missing table fails at parse time even when guarded by a
    // CASE — so existence has to be its own round trip.
    const tableCheck = await db.execute<{ present: boolean }>(
      sql`select to_regclass('drizzle.__drizzle_migrations') is not null as present`,
    );
    if (!tableCheck.rows[0]?.present) return;

    // bigint arrives as a string; cast so we parse one predictable shape.
    const result = await db.execute<{ highWaterMark: string | null }>(
      sql`select max(created_at)::text as "highWaterMark" from drizzle.__drizzle_migrations`,
    );
    const raw = result.rows[0]?.highWaterMark;
    if (raw == null) return; // table exists but empty — nothing applied yet

    const highWaterMark = Number(raw);
    if (highWaterMark > GENESIS_WHEN && highWaterMark < RETIRED_SEQUENCE_END) {
      throw new Error(
        `This database is stranded part-way through the retired 0000-0042 migration sequence ` +
          `(last applied ${highWaterMark}, which is between genesis's ${GENESIS_WHEN} and the ` +
          `sequence's end ${RETIRED_SEQUENCE_END}). Those migration files were collapsed into ` +
          `0000_genesis.sql and no longer exist, so this database cannot be brought up to date — ` +
          `it must be rebuilt from scratch.`,
      );
    }

    // The ambiguous case: `GENESIS_WHEN` means either "built from genesis" or
    // "ran the retired 0000 and stopped". Only the schema can tell them apart,
    // and drizzle would skip genesis for both.
    if (highWaterMark === GENESIS_WHEN) {
      const baseline = await db.execute<{ complete: boolean }>(
        sql`select to_regclass('public.projects') is not null as complete`,
      );
      if (!baseline.rows[0]?.complete) {
        throw new Error(
          `This database recorded the retired 0000 migration (${GENESIS_WHEN}) but never got ` +
            `past it — it holds the old auth tables and nothing else. That timestamp is also ` +
            `what 0000_genesis.sql records, so drizzle will skip genesis and leave the schema ` +
            `half-built. The retired migration files no longer exist, so this database cannot ` +
            `be brought up to date — it must be rebuilt from scratch.`,
        );
      }
    }
  }
}
