import { and, asc, eq, isNull, type SQL } from 'drizzle-orm';
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
  type NormalizedError,
  type OperationResult,
  type PersonaRole,
  type SampledDomain,
} from './types';

/** By-id documents run against the first K live ids (ordered by id) per domain. */
const SAMPLE_SIZE = 5;

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
}

/**
 * Domain → Postgres table for deterministic id sampling. Sampled from PG in
 * BOTH capture runs (POSTGRES_URL is always set), so the id sets are
 * identical across engines — the diff asserts this via the capture meta.
 */
const sampledTables: Readonly<Record<SampledDomain, SampledTable>> = {
  users: { table: users, id: users.id, deletedAt: users.deletedAt },
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
  projects: { table: projects, id: projects.id, deletedAt: projects.deletedAt },
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
};

const sampleIds = async (
  db: DrizzleDb,
): Promise<Record<SampledDomain, readonly string[]>> => {
  const out: Partial<Record<SampledDomain, readonly string[]>> = {};
  for (const [domain, spec] of Object.entries(sampledTables) as Array<
    [SampledDomain, SampledTable]
  >) {
    const conditions = [
      ...(spec.deletedAt ? [isNull(spec.deletedAt)] : []),
      ...(spec.predicate ? [spec.predicate] : []),
    ];
    const rows = await db
      .select({ id: spec.id })
      .from(spec.table)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(spec.id))
      .limit(SAMPLE_SIZE);
    out[domain] = rows.map((row) => String(row.id));
  }
  return out as Record<SampledDomain, readonly string[]>;
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
  const ops = expandCorpus(sampled);

  ctx.log(
    `\nShadow-diff capture — engine=${ctx.engine}\n` +
      `${ops.length} operations × ${personas.size} personas ` +
      `(${skipped.length} roles skipped)\n`,
  );

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
      sampledIds: sampled,
    },
    results,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `capture-${ctx.engine}.json`);
  fs.writeFileSync(outFile, JSON.stringify(capture, null, 2));
  ctx.log(`\nWrote ${results.length} results to ${outFile}`);
};
