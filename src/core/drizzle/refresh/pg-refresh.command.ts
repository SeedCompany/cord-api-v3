import { ModuleRef } from '@nestjs/core';
import { Command, Option } from 'clipanion';
import { sql } from 'drizzle-orm';
import { InjectableCommand } from '~/core/cli';
import { ConfigService } from '~/core/config';
import { DatabaseService } from '~/core/neo4j';
import { DrizzleService } from '../drizzle.service';
import { DrizzleMigrator } from '../migrator';

/**
 * Ad-hoc refresh of the Postgres database from a Neo4j source.
 *
 * Intended for the PG-test cutover environment: tear down the data, rebuild
 * the schema from migrations, then load a fresh copy of prod-shaped data via
 * the cutover ETL harness. Invoked out-of-band as an ECS task, never on a
 * schedule.
 *
 *   DATABASE=neo4j POSTGRES_URL=postgresql://... \
 *     yarn console:prod pg refresh --fresh
 *
 * Requires DATABASE=neo4j so that splitDb resolves the Neo4j repositories as
 * the readers. POSTGRES_URL is the write target — DrizzleService connects
 * whenever it is set, regardless of engine.
 *
 * The source Neo4j is whatever NEO4J_URL / NEO4J_USERNAME / NEO4J_PASSWORD are
 * configured to. Point them at a scrubbed production copy before running.
 * The cutover harness enforces this via its scrub gate.
 */
@InjectableCommand()
export class PgRefreshCommand extends Command {
  static paths = [['pg', 'refresh']];
  static usage = Command.Usage({
    category: 'Postgres',
    description: 'Tear down and reload the Postgres database from Neo4j',
    details: `
      Order of operations:
        1. --fresh  drop the schema (all data + migration history)
        2.          apply Drizzle migrations to rebuild the empty schema
        3.          load all data from Neo4j into Postgres

      Requires DATABASE=neo4j (so splitDb resolves the Neo4j repositories as
      the readers) and POSTGRES_URL set to the target database.
    `,
  });

  fresh = Option.Boolean('--fresh', false, {
    description: 'Drop the schema (data + migration history) before migrating',
  });
  productionSource = Option.Boolean('--production-source', false, {
    description:
      'Allow loading from a production-scale Neo4j without a scrub marker. ' +
      'Required for the real cutover. Omit for QA refreshes (scrubbed data only).',
  });
  only = Option.String('--only', {
    description:
      'Comma-separated extractor names to run, e.g. --only=tool,user',
  });
  batch = Option.String('--batch', {
    description: 'Insert batch size (default 500)',
  });

  constructor(
    private readonly config: ConfigService,
    private readonly drizzle: DrizzleService,
    private readonly migrator: DrizzleMigrator,
    private readonly neo4j: DatabaseService,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  async execute() {
    const write = (msg: string) => this.context.stdout.write(msg);

    if (!this.config.postgres.url) {
      write('Refusing to run: POSTGRES_URL is not set (the write target).\n');
      return 1;
    }
    if (this.config.databaseEngine !== 'neo4j') {
      write(
        `Refusing to run: DATABASE is "${this.config.databaseEngine}", expected "neo4j".\n` +
          'The cutover reads through Neo4j repositories — set DATABASE=neo4j.\n',
      );
      return 1;
    }

    if (this.fresh) {
      write('Dropping schema (data + migration history)…\n');
      try {
        await this.drizzle.client.execute(
          sql.raw(`drop schema if exists public cascade`),
        );
        await this.drizzle.client.execute(
          sql.raw(`drop schema if exists drizzle cascade`),
        );
        await this.drizzle.client.execute(sql.raw(`create schema public`));
      } catch (err: unknown) {
        write(`Drop failed: ${String(err)}\n`);
        if (err && typeof err === 'object' && 'cause' in err) {
          write(`Cause: ${String((err as { cause: unknown }).cause)}\n`);
        }
        throw err;
      }
    }

    write('Applying migrations…\n');
    await this.migrator.run();

    write('Loading data from Neo4j…\n');
    const { runCutover } = await import('../../cutover/cutover.harness.js');
    const { extractors } = await import('../../cutover/extractors/index.js');
    const { SessionManager } =
      await import('~/core/authentication/session/session.manager.js');

    const batchSize = this.batch ? Number(this.batch) : 500;
    const only = this.only?.split(',').filter(Boolean);
    const log = (msg: string) => write(msg + '\n');

    const sessions = this.moduleRef.get(SessionManager, { strict: false });
    const rootSession = await sessions.lazySessionForRootUser();
    await sessions.asUser(rootSession, async () => {
      await runCutover(
        {
          neo4j: this.neo4j,
          db: this.drizzle.client,
          moduleRef: this.moduleRef,
          dryRun: false,
          batchSize,
          allowProductionSource: this.productionSource,
          notHydrated: new Map(),
          log,
        },
        extractors,
        { only },
      );
    });

    write('Refresh complete.\n');
    return 0;
  }
}
