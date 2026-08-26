/**
 * Mutation probe — does WRITING work against migrated rows? (cutover tooling)
 *
 * Every mutation test in `test/` acts on a row the application created seconds
 * earlier. Migrated rows are the one shape that never covers: nulls where the
 * app always sets a value, names the loader defaulted, timestamps it stamped,
 * rows written in 2016 by code that no longer exists. This boots the API over a
 * copy of a loaded database and writes to real rows.
 *
 * It takes its OWN copy of the reference database before booting, so it cannot
 * write to the certified load even by accident. `CREATE DATABASE ... TEMPLATE`
 * takes about ten seconds for a 1.2 GB database, so every run starts pristine
 * and the copy is thrown away afterwards.
 *
 *   DATABASE=postgres POSTGRES_URL=postgresql://.../postgres \
 *     yarn start --entryFile core/mutation-probe.run -- --template=cord_cutover_r3
 *
 * Flags:
 *   --template=<db>  the loaded database to copy (required)
 *   --into=<db>      name for the working copy (default <template>_probe)
 *   --keep           leave the copy behind for inspection
 *   --rows=N         rows sampled per domain (default 5)
 *
 * Exits 1 when any probe failed.
 */
import { NestFactory } from '@nestjs/core';
import { exit } from 'node:process';
import { Client } from 'pg';
import '../polyfills';

// eslint-disable-next-line no-console
const log = (msg: string) => console.log(msg);

const parseFlags = (argv: readonly string[]) => {
  const get = (name: string) =>
    argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const template = get('template');
  if (!template) {
    throw new Error(
      '--template=<database> is required — the loaded database to copy. ' +
        'It is never written to; the probe works on a copy.',
    );
  }
  const rows = Number(get('rows') ?? 5);
  if (!Number.isInteger(rows) || rows < 1 || rows > 100) {
    throw new Error(`--rows must be a whole number 1..100 (got ${rows})`);
  }
  return {
    template,
    into: get('into') ?? `${template}_probe`,
    keep: argv.includes('--keep'),
    rows,
  };
};

/** Identifier interpolation: these are database names, not values. */
const quoteIdent = (name: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe database name: ${name}`);
  }
  return `"${name}"`;
};

const copyDatabase = async (
  adminUrl: string,
  template: string,
  into: string,
) => {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const exists = await admin.query<{ n: number }>(
      'select count(*)::int n from pg_database where datname = $1',
      [template],
    );
    if (exists.rows[0]?.n !== 1) {
      throw new Error(`No such database to copy: ${template}`);
    }
    // Postgres refuses to copy a template that anybody is connected to, which
    // is a guard rather than an obstacle: it means the source cannot be moving
    // underneath the copy.
    const busy = await admin.query<{ n: number }>(
      'select count(*)::int n from pg_stat_activity where datname = $1',
      [template],
    );
    if ((busy.rows[0]?.n ?? 0) > 0) {
      throw new Error(
        `${busy.rows[0]!.n} session(s) are connected to ${template}, so it ` +
          `cannot be copied. Disconnect them and run again.`,
      );
    }
    log(`Copying ${template} -> ${into} …`);
    const started = Date.now();
    await admin.query(`drop database if exists ${quoteIdent(into)}`);
    await admin.query(
      `create database ${quoteIdent(into)} template ${quoteIdent(template)}`,
    );
    log(`  copied in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } finally {
    await admin.end();
  }
};

const dropDatabase = async (adminUrl: string, name: string) => {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(
      `drop database if exists ${quoteIdent(name)} with (force)`,
    );
  } finally {
    await admin.end();
  }
};

async function bootstrap() {
  const flags = parseFlags(process.argv.slice(2));

  const adminUrl = process.env.POSTGRES_URL;
  if (!adminUrl) {
    throw new Error('POSTGRES_URL is required (any database on the server).');
  }
  await copyDatabase(adminUrl, flags.template, flags.into);

  // Point the app at the COPY before anything reads config. From here on the
  // reference database is untouchable by this process.
  const copyUrl = new URL(adminUrl);
  copyUrl.pathname = `/${flags.into}`;
  process.env.POSTGRES_URL = copyUrl.toString();
  process.env.DATABASE = 'postgres';

  // Same reasoning as the shadow-diff capture: merely booting the AppModule
  // writes (the root-objects bootstrap rewrites the root user, and index
  // creation is DDL). Here that would show up as probe noise on the very rows
  // being measured.
  process.env.DB_ROOT_OBJECTS_SYNC = 'false';
  process.env.DB_CREATE_INDEXES = 'false';

  // CLI mode: loaders resolve against CLI_CONTEXT_ID and the scheduler stays off.
  process.argv.push('console');

  const { AppModule } = await import('../app.module');
  const { GraphQLSchemaHost } = await import('@nestjs/graphql');
  const { Identity } = await import('~/core/authentication');
  const { SessionManager } =
    await import('~/core/authentication/session/session.manager');
  const { DrizzleService } = await import('~/core/drizzle/drizzle.service');
  const { GqlContextHostImpl } =
    await import('~/core/graphql/gql-context.host');
  const { HttpAdapter } = await import('~/core/http');
  const { report, runProbes, sampleIds } =
    await import('./mutation-probe/probe');
  const { probes, sampledTables } = await import('./mutation-probe/probes');
  const { and, asc, eq, isNull } = await import('drizzle-orm');
  const { userGlobalRoles, users } = await import('~/core/drizzle/schema');

  // A full app, not an application context: the GraphQL module only builds the
  // schema when an HTTP adapter is present. Initialised, never listening.
  const app = await NestFactory.create(AppModule, new HttpAdapter(), {
    logger: ['error', 'warn'],
  });
  let clean = false;
  try {
    await app.init();
    await app.get(SessionManager).lazySessionForRootUser();

    const db = app.get(DrizzleService).client;
    // The live Administrator with the lowest id — deterministic, so two runs
    // act as the same person. Resolved here rather than imported from the
    // shadow-diff harness, which lives only on the ETL branch: this probe has
    // to run on develop-based branches too, which is how it gets compared
    // against a branch that fixes something.
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userGlobalRoles, eq(userGlobalRoles.userId, users.id))
      .where(
        and(eq(userGlobalRoles.role, 'Administrator'), isNull(users.deletedAt)),
      )
      .orderBy(asc(users.id))
      .limit(1);
    const actor = admins[0]?.id;
    if (!actor) {
      throw new Error(
        'No live Administrator in the loaded data — the probes need one to ' +
          'act as. This is a finding about the load, not about the probe.',
      );
    }

    const ids = await sampleIds(db, sampledTables, flags.rows);
    log(
      `\nMutation probe — working copy ${flags.into}\n` +
        `acting as Administrator ${actor}\n` +
        `${probes.length} probes over ${flags.rows} migrated row(s) each\n`,
    );

    const outcomes = await runProbes(
      {
        schema: app.get(GraphQLSchemaHost).schema,
        identity: app.get(Identity),
        gqlContextAls: app.get(GqlContextHostImpl).als,
        db,
        actor,
        log,
      },
      probes,
      ids,
    );
    clean = report(outcomes, log);
  } finally {
    await app.close();
    if (!flags.keep) {
      await dropDatabase(adminUrl, flags.into);
      log(`\nDropped the working copy ${flags.into}.`);
    } else {
      log(`\nKept the working copy ${flags.into} (--keep).`);
    }
  }
  exit(clean ? 0 : 1);
}

void bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
