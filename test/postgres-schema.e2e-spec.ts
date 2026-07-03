import { beforeAll, describe, expect, it } from '@jest/globals';
import { sql } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type MadeEnum, Role, Sensitivity } from '~/common';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle';
import { PartnerType } from '../src/components/partner/dto';
import { ProjectStep, stepToStatus } from '../src/components/project/dto';
import { createTestApp, type TestApp } from './utility';

// These assertions introspect the live Postgres catalog + the on-disk drizzle
// migrations, so they only make sense under DATABASE=postgres. Under neo4j the
// whole suite is skipped (the schema doesn't exist there).
// migration-todo: drop the engine gate at Phase 7 cutover (always postgres).
const isPostgres = process.env.DATABASE === 'postgres';
const d = isPostgres ? describe : describe.skip;

const migrationsDir = resolve(process.cwd(), 'src/core/drizzle/migrations');

d('Postgres schema invariants', () => {
  let app: TestApp;
  let db: DrizzleDb;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DrizzleService).client;
  });

  // Every foreign-key column must be the leading column of *some* index. An
  // unindexed FK silently degrades joins/cascades and is the single most common
  // omission in machine-generated migrations. (A FK that is the leftmost column
  // of the primary key is already covered by the PK index, so it passes.)
  it('indexes the leading column of every foreign key', async () => {
    const result = await db.execute<
      {
        tableName: string;
        columnName: string;
        constraintName: string;
      } & Record<string, unknown>
    >(sql`
      select rel.relname  as "tableName",
             att.attname  as "columnName",
             con.conname  as "constraintName"
      from pg_constraint con
      join pg_class rel       on rel.oid = con.conrelid
      join pg_namespace nsp   on nsp.oid = rel.relnamespace
      join pg_attribute att   on att.attrelid = con.conrelid
                             and att.attnum = con.conkey[1]
      where con.contype = 'f'
        and nsp.nspname = 'public'
        and not exists (
          select 1 from pg_index i
          where i.indrelid = con.conrelid
            and i.indkey[0] = con.conkey[1]
        )
      order by 1, 2
    `);

    const unindexed = result.rows.map(
      (r) => `${r.tableName}.${r.columnName} (${r.constraintName})`,
    );
    expect(unindexed).toEqual([]);
  });

  // The migration files and the drizzle journal must agree: contiguous numeric
  // prefixes with no gaps/dupes, and one journal entry per file with a matching
  // tag. A mismatch here means a migration won't apply (or applies twice) on a
  // fresh database — exactly the cutover failure we can't afford to discover in
  // production.
  it('has a contiguous, journal-consistent migration set', () => {
    const sqlFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    const fileIdxs = sqlFiles.map((f) => {
      const m = /^(\d{4})_/.exec(f);
      // migration file must be NNNN_ prefixed
      expect(m).toBeTruthy();
      return Number(m![1]);
    });
    // contiguous 0..n-1, no gaps or duplicates
    expect(fileIdxs).toEqual(sqlFiles.map((_, i) => i));

    const journal = JSON.parse(
      readFileSync(resolve(migrationsDir, 'meta', '_journal.json'), 'utf8'),
    ) as { entries: Array<{ idx: number; tag: string }> };

    expect(journal.entries).toHaveLength(sqlFiles.length);
    journal.entries.forEach((entry, i) => {
      expect(entry.idx).toBe(i);
      expect(sqlFiles).toContain(`${entry.tag}.sql`);
    });
  });

  // `projects.status` is a STORED generated column whose CASE expression must
  // mirror the TypeScript `stepToStatus()` mapping exactly — they're two copies
  // of the same business rule and drift between them is invisible until a
  // project lands in the wrong status bucket.
  it('generates projects.status identically to stepToStatus()', async () => {
    const result = await db.execute<{ expr: string } & Record<string, unknown>>(
      sql`
        select pg_get_expr(def.adbin, def.adrelid) as expr
        from pg_attrdef def
        join pg_attribute a on a.attrelid = def.adrelid and a.attnum = def.adnum
        join pg_class c     on c.oid = def.adrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'projects'
          and a.attname = 'status'
      `,
    );
    const expr = result.rows[0]?.expr;
    // projects.status must have a generation expression
    expect(expr).toBeTruthy();

    for (const step of ProjectStep) {
      const re = new RegExp(
        `'${step}'::project_step\\)?\\s+THEN\\s+\\(?'([A-Za-z]+)'::project_status`,
      );
      const match = re.exec(expr!);
      // generated status must map every project step
      expect(match).toBeTruthy();
      expect(match![1]).toBe(stepToStatus(step));
    }
  });

  // A curated set of enums that gate real behavior. Each SQL enum's label set
  // must equal its TypeScript counterpart's value set — a value present on one
  // side but not the other is a write that fails at runtime or a filter that
  // silently never matches.
  // migration-todo: restore ['engagement_status', EngagementStatus],
  // ['progress_report_status', ProgressReportStatus], and
  // ['report_type', ReportType] (mono's full curated list) as the Engagement
  // and Report-cluster domains recut onto develop — their pg enums don't
  // exist here yet.
  const enumPairs: ReadonlyArray<[pgName: string, tsEnum: MadeEnum<string>]> = [
    ['project_step', ProjectStep],
    ['partner_type', PartnerType],
    ['role', Role],
    ['sensitivity', Sensitivity],
  ];

  it.each(enumPairs)(
    'keeps SQL enum %s in sync with its TypeScript enum',
    async (pgName, tsEnum) => {
      const result = await db.execute<
        { labels: string[] } & Record<string, unknown>
      >(sql`
        select array_agg(e.enumlabel::text order by e.enumlabel::text) as labels
        from pg_type t
        join pg_enum e      on e.enumtypid = t.oid
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = ${pgName}
      `);
      const pgLabels = result.rows[0]?.labels ?? [];
      // the pg enum must exist
      expect(pgLabels.length).toBeGreaterThan(0);

      const cmp = (a: string, b: string) => a.localeCompare(b);
      expect([...pgLabels].sort(cmp)).toEqual([...tsEnum.values].sort(cmp));
    },
  );
});
