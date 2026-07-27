import { Command, Option } from 'clipanion';
import { sql } from 'drizzle-orm';
import { InjectableCommand } from '~/core/cli';
import { ConfigService } from '~/core/config';
import { DrizzleService } from '../drizzle.service';
import { DrizzleMigrator } from '../migrator';
import { PgEtlService } from './pg-etl.service';

/**
 * Ad-hoc refresh of the Postgres database from a Neo4j source.
 *
 * Intended for the PG-test cutover environment: tear down the data, rebuild
 * the schema from migrations, then load a fresh copy of prod-shaped data.
 * Invoked out-of-band as an ECS task (see infra `scripts/refresh-pg-test.sh`),
 * never on a schedule.
 *
 *   yarn console:prod pg refresh --fresh --source bolt://<staged-neo4j>:7687
 */
@InjectableCommand()
export class PgRefreshCommand extends Command {
  static paths = [['pg', 'refresh']];
  static usage = Command.Usage({
    category: 'Postgres',
    description:
      'Tear down and reload the Postgres database from a Neo4j source',
    details: `
      Order of operations:
        1. --fresh  drop the schema (all data + migration history)
        2.          apply Drizzle migrations to rebuild the empty schema
        3.          load data from the source Neo4j into Postgres

      Refuses to run unless DATABASE=postgres. The source defaults to the
      configured NEO4J_URL; pass --source to read from a staged copy instead.
    `,
  });

  fresh = Option.Boolean('--fresh', false, {
    description: 'Drop the schema (data + migration history) before migrating',
  });
  source = Option.String('--source', {
    description: 'Bolt URL of the source Neo4j (defaults to NEO4J_URL)',
  });
  sourceUser = Option.String('--source-user', {
    description: 'Source Neo4j username (defaults to NEO4J_USERNAME)',
  });
  sourcePassword = Option.String('--source-password', {
    description: 'Source Neo4j password (defaults to NEO4J_PASSWORD)',
  });

  constructor(
    private readonly config: ConfigService,
    private readonly drizzle: DrizzleService,
    private readonly migrator: DrizzleMigrator,
    private readonly etl: PgEtlService,
  ) {
    super();
  }

  async execute() {
    if (this.config.databaseEngine !== 'postgres') {
      this.context.stdout.write(
        `Refusing to run: DATABASE is "${this.config.databaseEngine}", not "postgres".\n`,
      );
      return 1;
    }

    if (this.fresh) {
      this.context.stdout.write(
        'Dropping schema (data + migration history)…\n',
      );
      // Drop the drizzle schema too, so migrations re-apply from scratch.
      await this.drizzle.client.execute(
        sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`,
      );
    }

    this.context.stdout.write('Applying migrations…\n');
    await this.migrator.run();

    this.context.stdout.write('Loading data from Neo4j…\n');
    const neo4j = this.config.neo4j;
    await this.etl.run({
      url: this.source ?? neo4j.url,
      username: this.sourceUser ?? neo4j.username,
      password: this.sourcePassword ?? neo4j.password,
      database: neo4j.database,
    });

    this.context.stdout.write('Refresh complete.\n');
    return 0;
  }
}
