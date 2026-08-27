import { and, asc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { type AnyPgColumn, type PgTable } from 'drizzle-orm/pg-core';
import {
  graphql,
  type GraphQLError,
  Kind,
  type OperationDefinitionNode,
  parse,
} from 'graphql';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { type GqlContextType, type ID } from '~/common';
import { type DrizzleDb } from '~/core/drizzle/drizzle.service';
import {
  commentThreads,
  engagements,
  fieldRegions,
  fieldZones,
  fundingAccounts,
  languages,
  locations,
  organizations,
  partners,
  partnerships,
  periodicReports,
  posts,
  products,
  projects,
  tools,
  users,
} from '~/core/drizzle/schema';
import { isGqlContext } from '~/core/graphql/gql-context.host';
import { corpus } from './corpus';
import { resolvePersonas } from './personas';
import { redactCaptured, redactMessage } from './redact';
import {
  type CaptureFile,
  type CaptureRunContext,
  type DomainStrata,
  type NormalizedError,
  type OperationResult,
  type PersonaRole,
  type SampledDomain,
  type StratumTally,
} from './types';

/** How many ids each stratum contributes per domain (before dedup). */
const STRATUM_SIZE = 5;

/**
 * The pre-2021 id shape — 24 hex characters. The id scheme changed to short
 * random strings in Feb 2021, and because ids sort as text, "first K by id"
 * NEVER reached a legacy row (the first legacy project sits at position 217).
 * That is how 1,560 wrong step-change dates, 2,065 timezone-shifted
 * timestamps, and the ceremonies.planned drift all sailed through a clean
 * report: no record created before 2021 had ever been compared. Verified
 * against the loaded reference: 2,881 of 5,284 projects match this shape.
 */
const LEGACY_ID_SHAPE = '^[0-9a-f]{24}$';

interface SampledTable {
  readonly table: PgTable;
  readonly id: AnyPgColumn;
  /**
   * Optional because not every migrated table is soft-deleted: `periodic_reports`
   * deliberately has NO `deleted_at` (deterministic ids + real deletes), so
   * requiring one here would have forced a fake column to sample it.
   */
  readonly deletedAt?: AnyPgColumn;
  /** Extra narrowing, e.g. progress reports = periodic_reports type='Progress'. */
  readonly predicate?: SQL;
  /**
   * Rows the loader had to treat specially — the shapes most likely to read
   * differently between engines (a blank the app never writes, say). Drawn as
   * their own stratum so "the odd rows" cannot lose the lottery to ordinary
   * ones. Migration 0042 made these blanks representable; nothing else in the
   * corpus would ever deliberately pick one.
   */
  readonly flagged?: SQL;
}

/**
 * Domain → Postgres table for deterministic id sampling. Sampled from PG in
 * BOTH capture runs (POSTGRES_URL is always set), so the id sets are
 * identical across engines — the diff asserts this via the capture meta.
 */
const sampledTables: Readonly<Record<SampledDomain, SampledTable>> = {
  users: {
    table: users,
    id: users.id,
    deletedAt: users.deletedAt,
    flagged: isNull(users.status),
  },
  tools: { table: tools, id: tools.id, deletedAt: tools.deletedAt },
  fundingAccounts: {
    table: fundingAccounts,
    id: fundingAccounts.id,
    deletedAt: fundingAccounts.deletedAt,
  },
  locations: {
    table: locations,
    id: locations.id,
    deletedAt: locations.deletedAt,
  },
  fieldZones: {
    table: fieldZones,
    id: fieldZones.id,
    deletedAt: fieldZones.deletedAt,
  },
  fieldRegions: {
    table: fieldRegions,
    id: fieldRegions.id,
    deletedAt: fieldRegions.deletedAt,
  },
  organizations: {
    table: organizations,
    id: organizations.id,
    deletedAt: organizations.deletedAt,
  },
  partners: { table: partners, id: partners.id, deletedAt: partners.deletedAt },
  projects: {
    table: projects,
    id: projects.id,
    deletedAt: projects.deletedAt,
    flagged: isNull(projects.presetInventory),
  },
  partnerships: {
    table: partnerships,
    id: partnerships.id,
    deletedAt: partnerships.deletedAt,
  },
  languages: {
    table: languages,
    id: languages.id,
    deletedAt: languages.deletedAt,
  },
  engagements: {
    table: engagements,
    id: engagements.id,
    deletedAt: engagements.deletedAt,
    flagged: isNull(engagements.marketable),
  },
  products: { table: products, id: products.id, deletedAt: products.deletedAt },
  // No deletedAt — periodic_reports is real-delete by design.
  periodicReports: { table: periodicReports, id: periodicReports.id },
  progressReports: {
    table: periodicReports,
    id: periodicReports.id,
    predicate: eq(periodicReports.type, 'Progress'),
  },
  commentThreads: { table: commentThreads, id: commentThreads.id },
  posts: { table: posts, id: posts.id },
  // Budget has no top-level query, so budget depth is read through
  // `project(id).budget`. The draw is PROJECT ids, narrowed to projects whose
  // current data actually exercises the selection: a live budget with at
  // least one live record. Flagged = a record with a NULL amount — the blank
  // the loader now preserves (17 of the 1,945 Neo4j blanks belonged to the 45
  // dropped records; the rest must read back as blanks, not 0).
  budgetedProjects: {
    table: projects,
    id: projects.id,
    deletedAt: projects.deletedAt,
    predicate: sql`EXISTS (
      SELECT 1 FROM budgets b
      JOIN budget_records br ON br.budget_id = b.id AND br.deleted_at IS NULL
      WHERE b.project_id = ${projects.id} AND b.deleted_at IS NULL
    )`,
    flagged: sql`EXISTS (
      SELECT 1 FROM budgets b
      JOIN budget_records br ON br.budget_id = b.id AND br.deleted_at IS NULL
      WHERE b.project_id = ${projects.id} AND b.deleted_at IS NULL
        AND br.amount IS NULL
    )`,
  },
  // Ceremony also has no top-level query — read through the engagement
  // document. This domain IS the kept-blank population (7,386 ceremonies with
  // NULL planned after migration 0042), so no separate flagged stratum: every
  // stratum here already draws the odd rows.
  ceremonyBlankEngagements: {
    table: engagements,
    id: engagements.id,
    deletedAt: engagements.deletedAt,
    predicate: sql`EXISTS (
      SELECT 1 FROM ceremonies c
      WHERE c.engagement_id = ${engagements.id}
        AND c.deleted_at IS NULL AND c.planned IS NULL
    )`,
  },
};

interface SampledIds {
  readonly ids: Record<SampledDomain, readonly string[]>;
  readonly strata: Record<SampledDomain, DomainStrata>;
}

/**
 * Draw ids per domain in deliberate strata rather than "first K by id".
 *
 * Strata, in draw order:
 * - `legacy`   — pre-2021 ids (24-hex). The rows the old sampler could never
 *                reach, and where migration damage actually lives.
 * - `modern`   — everything else, first K by id (the old sampler's draw).
 * - `shuffled` — ordered by md5(id): a deterministic pseudo-random draw across
 *                both eras, so the sample is not only edge rows. Deterministic
 *                on purpose — the same ids come back run after run, and both
 *                capture runs sample from the same Postgres.
 * - `flagged`  — rows the loader treated specially (blanks in newly nullable
 *                columns), where a domain declares them.
 *
 * Later strata drop ids an earlier stratum already picked; the tally records
 * population / drawn / added per stratum so the report can prove what was
 * covered. A stratum that draws nothing from a non-empty population throws —
 * a silent empty stratum is exactly the blindness this replaces.
 */
const sampleIds = async (db: DrizzleDb): Promise<SampledIds> => {
  const ids: Partial<Record<SampledDomain, readonly string[]>> = {};
  const strata: Partial<Record<SampledDomain, DomainStrata>> = {};

  for (const [domain, spec] of Object.entries(sampledTables) as Array<
    [SampledDomain, SampledTable]
  >) {
    const base = [
      ...(spec.deletedAt ? [isNull(spec.deletedAt)] : []),
      ...(spec.predicate ? [spec.predicate] : []),
    ];
    const isLegacy = sql`${spec.id} ~ ${LEGACY_ID_SHAPE}`;
    const notLegacy = sql`${spec.id} !~ ${LEGACY_ID_SHAPE}`;

    const stratumDefs: ReadonlyArray<{
      name: string;
      where: SQL | undefined;
      orderBy: SQL | ReturnType<typeof asc>;
    }> = [
      { name: 'legacy', where: isLegacy, orderBy: asc(spec.id) },
      { name: 'modern', where: notLegacy, orderBy: asc(spec.id) },
      { name: 'shuffled', where: undefined, orderBy: sql`md5(${spec.id})` },
      ...(spec.flagged
        ? [{ name: 'flagged', where: spec.flagged, orderBy: asc(spec.id) }]
        : []),
    ];

    const picked: string[] = [];
    const seen = new Set<string>();
    const tally: Record<string, StratumTally> = {};

    for (const stratum of stratumDefs) {
      const where = and(...base, ...(stratum.where ? [stratum.where] : []));
      // Annotated because `spec.table` is a bare PgTable, which drops the
      // dynamic select to `any`.
      const populationRows: Array<{ population: number }> = await db
        .select({ population: sql<number>`count(*)::int` })
        .from(spec.table)
        .where(where);
      const population = populationRows[0]?.population ?? 0;
      const rows = await db
        .select({ id: spec.id })
        .from(spec.table)
        .where(where)
        .orderBy(stratum.orderBy)
        .limit(STRATUM_SIZE);

      if (population > 0 && rows.length === 0) {
        throw new Error(
          `Sampling bug: domain "${domain}" stratum "${stratum.name}" has ` +
            `${population} live rows but the draw returned none.`,
        );
      }

      let added = 0;
      for (const row of rows) {
        const id = String(row.id);
        if (seen.has(id)) continue;
        seen.add(id);
        picked.push(id);
        added += 1;
      }
      tally[stratum.name] = { population, drawn: rows.length, added };
    }

    ids[domain] = picked;
    strata[domain] = tally;
  }

  return {
    ids: ids as Record<SampledDomain, readonly string[]>,
    strata: strata as Record<SampledDomain, DomainStrata>,
  };
};

/** A corpus entry expanded to a concrete (single) execution. */
interface ExpandedOp {
  readonly key: string;
  readonly document: string;
  readonly variables?: Readonly<Record<string, unknown>>;
}

const expandCorpus = (
  sampledIds: Record<SampledDomain, readonly string[]>,
): ExpandedOp[] =>
  corpus.flatMap((entry): ExpandedOp[] => {
    if (!entry.idsFrom) {
      return [
        {
          key: entry.key,
          document: entry.document,
          variables: entry.variables,
        },
      ];
    }
    return sampledIds[entry.idsFrom].map((id) => ({
      key: `${entry.key}:${id}`,
      document: entry.document,
      variables: { ...entry.variables, id },
    }));
  });

/** Strip GraphQL errors to a comparable shape — message + code + path only. */
const normalizeError = (error: GraphQLError): NormalizedError => ({
  message: redactMessage(error.message),
  ...(typeof error.extensions.code === 'string'
    ? { code: error.extensions.code }
    : {}),
  ...(error.path ? { path: [...error.path] } : {}),
});

const operationCache = new Map<string, OperationDefinitionNode>();
const operationOf = (source: string): OperationDefinitionNode => {
  const cached = operationCache.get(source);
  if (cached) return cached;
  const operation = parse(source).definitions.find(
    (def): def is OperationDefinitionNode =>
      def.kind === Kind.OPERATION_DEFINITION,
  );
  if (!operation) {
    throw new Error('Corpus document has no operation definition');
  }
  operationCache.set(source, operation);
  return operation;
};

/**
 * Execute one corpus operation in-process as the given persona.
 *
 * Wiring notes (each piece is load-bearing — see README):
 * - The context object carries `isGqlContext.KEY` + `operation` but NO
 *   `request`: with a request present, the SessionInterceptor would resolve a
 *   session from it and overwrite the persona session; without one it
 *   early-returns and the `identity.asUser` session stands.
 * - `gqlContextAls.run(...)` populates GqlContextHostImpl for anything that
 *   reads `contextHost.context` (e.g. TransactionHooks) — in-process
 *   execution bypasses the Yoga plugin that normally does this.
 * - The process runs in CLI mode ('console' in argv), so ResourceLoader
 *   resolves loaders against CLI_CONTEXT_ID and loader caching is off, while
 *   `@Loader()` params still scope to the persona session via getLifetimeId.
 */
const executeAs = async (
  ctx: CaptureRunContext,
  userId: ID<'User'>,
  op: ExpandedOp,
): Promise<Pick<OperationResult, 'data' | 'errors'>> => {
  const contextValue = Object.assign(Object.create(null) as GqlContextType, {
    [isGqlContext.KEY]: true,
    operation: operationOf(op.document),
  });
  const result = await ctx.gqlContextAls.run(
    contextValue,
    async () =>
      await ctx.identity.asUser(
        userId,
        async () =>
          await graphql({
            schema: ctx.schema,
            source: op.document,
            variableValues: op.variables,
            contextValue,
          }),
      ),
  );
  // Redact BEFORE anything is retained: capture files previously held names,
  // emails, phone numbers, comment/post bodies and 213 sensitivity=High records
  // in plain text. Hashing preserves the parity check (same value -> same digest
  // on both engines) while storing nothing readable. See redact.ts.
  return {
    data: redactCaptured(result.data ?? null),
    errors: (result.errors ?? []).map(normalizeError),
  };
};

/**
 * Replay the whole corpus under every resolvable persona and write
 * `capture-<engine>.json` into `outDir`.
 */
export const runCapture = async (
  ctx: CaptureRunContext,
  outDir: string,
): Promise<void> => {
  const { personas, skipped } = await resolvePersonas(ctx.db, ctx.log);
  const sampled = await sampleIds(ctx.db);
  const ops = expandCorpus(sampled.ids);

  ctx.log(
    `\nShadow-diff capture — engine=${ctx.engine}\n` +
      `${ops.length} operations × ${personas.size} personas ` +
      `(${skipped.length} roles skipped)\n`,
  );
  // The draw, out loud: "reads match" is only as strong as what was compared,
  // and a stratum quietly drawing nothing is how 55% of projects went
  // uncompared for six weeks. `added 0` after a slash means the rows were
  // already covered by an earlier stratum, not missed.
  ctx.log('Sampled ids per domain (drawn/population, +added after dedup):');
  for (const [domain, tally] of Object.entries(sampled.strata)) {
    const parts = Object.entries(tally).map(
      ([name, s]) => `${name} ${s.drawn}/${s.population}+${s.added}`,
    );
    const total = sampled.ids[domain as SampledDomain].length;
    ctx.log(
      `  ${domain.padEnd(18)} ${String(total).padStart(2)} ids — ${parts.join(', ')}`,
    );
  }
  ctx.log('');

  const results: OperationResult[] = [];
  for (const [role, userId] of personas) {
    const started = process.hrtime.bigint();
    for (const op of ops) {
      const { data, errors } = await executeAs(ctx, userId, op);
      results.push({ op: op.key, persona: role, data, errors });
    }
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const errorCount = results.filter(
      (r) => r.persona === role && r.errors.length > 0,
    ).length;
    ctx.log(
      `  ${role} (${userId}): ${ops.length} ops, ` +
        `${errorCount} with errors (${ms.toFixed(0)}ms)`,
    );
  }

  const capture: CaptureFile = {
    meta: {
      engine: ctx.engine,
      capturedAt: new Date().toISOString(),
      personas: Object.fromEntries(personas) as Partial<
        Record<PersonaRole, string>
      >,
      skippedPersonas: skipped,
      sampledIds: sampled.ids,
      strata: sampled.strata,
    },
    results,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `capture-${ctx.engine}.json`);
  fs.writeFileSync(outFile, JSON.stringify(capture, null, 2));
  ctx.log(`\nWrote ${results.length} results to ${outFile}`);
};
