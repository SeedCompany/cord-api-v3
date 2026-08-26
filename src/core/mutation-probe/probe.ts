import { and, asc, isNull, type SQL } from 'drizzle-orm';
import { type AnyPgColumn, type PgTable } from 'drizzle-orm/pg-core';
import { graphql, type GraphQLSchema, Kind, parse } from 'graphql';
import { type AsyncLocalStorage } from 'node:async_hooks';
import { type GqlContextType, type ID } from '~/common';
import { type Identity } from '~/core/authentication';
import { type DrizzleDb } from '~/core/drizzle/drizzle.service';
import { isGqlContext } from '~/core/graphql/gql-context.host';

/**
 * Does WRITING work against MIGRATED rows?
 *
 * Everything the cutover has proven so far is about reading: that nothing was
 * forgotten, that every row moved, that the two databases answer reads the same
 * way. Nothing tests a mutation against a row the ETL loaded. Every mutation
 * test in `test/` acts on a row the application created seconds earlier, which
 * is the one shape migrated data never has.
 *
 * That distinction is not academic. `partners.sensitivity` was a stored column
 * nothing on Postgres maintained: reads matched perfectly across all sampled
 * partner captures, because the ETL had loaded correct values. It would only
 * have gone wrong on the first write, to the column that decides who may see
 * the record.
 *
 * Migrated rows carry shapes the app never writes: nulls where it always sets a
 * value, names the loader defaulted to "(unnamed)", timestamps it stamped at
 * load time, rows from 2016 written by code that no longer exists, and
 * relationships that have since become required.
 *
 * The contract for every probe is deliberately stronger than "it did not
 * throw": write, then READ BACK and confirm the value actually changed. A
 * repository that accepts an update and quietly does nothing is exactly the
 * defect shape that got through review twice, and it passes a does-it-error
 * check every time.
 */

export interface ProbeContext {
  readonly schema: GraphQLSchema;
  readonly identity: Identity;
  readonly gqlContextAls: AsyncLocalStorage<GqlContextType>;
  readonly db: DrizzleDb;
  /** The migrated user the probes act as. */
  readonly actor: ID<'User'>;
  readonly log: (msg: string) => void;
  /** Run one GraphQL document as the actor; throws on any GraphQL error. */
  readonly gql: <T = Record<string, unknown>>(
    document: string,
    variables?: Record<string, unknown>,
  ) => Promise<T>;
}

/**
 * Returned when a row cannot answer the question this probe asks — for
 * instance a partner already at the lowest sensitivity, which leaves nothing
 * for a "does it go lower" check to observe. Reported as its own count rather
 * than folded into the passes, because a probe that could not run is not
 * evidence of anything and must never read as one.
 */
export interface NotApplicable {
  readonly notApplicable: string;
}

const isNotApplicable = (v: unknown): v is NotApplicable =>
  typeof v === 'object' && v !== null && 'notApplicable' in v;

/** One thing to try against one migrated row. */
export interface Probe {
  /** The mutation being exercised. Used as the report key. */
  readonly key: string;
  /** Which table to draw real, already-migrated rows from. */
  readonly domain: string;
  /** Throw to fail. The message is what the report shows. */
  readonly run: (ctx: ProbeContext, id: ID) => Promise<void | NotApplicable>;
}

export interface SampledTable {
  readonly table: PgTable;
  readonly id: AnyPgColumn;
  readonly deletedAt?: AnyPgColumn;
  readonly predicate?: SQL;
}

export interface ProbeOutcome {
  readonly key: string;
  readonly id: ID;
  readonly ok: boolean;
  readonly error?: string;
  /** Set when the row could not answer the question. Never counted as a pass. */
  readonly notApplicable?: string;
}

/**
 * Rows are taken in id order rather than at random, so a failure can be
 * reproduced and quoted. They are NOT filtered for tidiness: the awkward rows
 * are the entire point of this exercise.
 */
export const sampleIds = async (
  db: DrizzleDb,
  tables: Readonly<Record<string, SampledTable>>,
  perDomain: number,
): Promise<Record<string, readonly ID[]>> => {
  const out: Record<string, readonly ID[]> = {};
  for (const [domain, spec] of Object.entries(tables)) {
    const conditions = [
      ...(spec.deletedAt ? [isNull(spec.deletedAt)] : []),
      ...(spec.predicate ? [spec.predicate] : []),
    ];
    const rows = await db
      .select({ id: spec.id })
      .from(spec.table)
      .where(conditions.length === 0 ? undefined : and(...conditions))
      .orderBy(asc(spec.id))
      .limit(perDomain);
    out[domain] = rows.map((row) => String(row.id) as ID);
  }
  return out;
};

const documentCache = new Map<string, ReturnType<typeof parse>>();

/**
 * Execute in-process as the actor. Same wiring as the shadow-diff capture, and
 * for the same reasons: a context carrying no `request`, so the session
 * interceptor leaves the impersonated session alone, and an explicit `als.run`
 * because nothing here goes through the Yoga plugin that normally fills it.
 */
export const makeGql =
  (ctx: Omit<ProbeContext, 'gql'>): ProbeContext['gql'] =>
  async <T = Record<string, unknown>>(
    document: string,
    variables?: Record<string, unknown>,
  ): Promise<T> => {
    let parsed = documentCache.get(document);
    if (!parsed) {
      parsed = parse(document);
      documentCache.set(document, parsed);
    }
    const operation = parsed.definitions.find(
      (def) => def.kind === Kind.OPERATION_DEFINITION,
    );
    const contextValue = Object.assign(Object.create(null) as GqlContextType, {
      [isGqlContext.KEY]: true,
      operation,
    });
    const result = await ctx.gqlContextAls.run(
      contextValue,
      async () =>
        await ctx.identity.asUser(
          ctx.actor,
          async () =>
            await graphql({
              schema: ctx.schema,
              source: document,
              variableValues: variables,
              contextValue,
            }),
        ),
    );
    if (result.errors?.length) {
      // Message only. A probe report is read by a person, and the stack belongs
      // to this process rather than to the thing that went wrong.
      throw new Error(result.errors.map((e) => e.message).join(' | '));
    }
    return result.data as T;
  };

export const runProbes = async (
  ctx: Omit<ProbeContext, 'gql'>,
  probes: readonly Probe[],
  ids: Record<string, readonly ID[]>,
): Promise<readonly ProbeOutcome[]> => {
  const full: ProbeContext = { ...ctx, gql: makeGql(ctx) };
  const outcomes: ProbeOutcome[] = [];

  for (const probe of probes) {
    const targets = ids[probe.domain] ?? [];
    if (targets.length === 0) {
      ctx.log(
        `  ${probe.key}: no migrated rows in "${probe.domain}" — skipped`,
      );
      continue;
    }
    let ok = 0;
    let na = 0;
    for (const id of targets) {
      try {
        const result = await probe.run(full, id);
        if (isNotApplicable(result)) {
          outcomes.push({
            key: probe.key,
            id,
            ok: false,
            notApplicable: result.notApplicable,
          });
          na++;
        } else {
          outcomes.push({ key: probe.key, id, ok: true });
          ok++;
        }
      } catch (err: unknown) {
        outcomes.push({
          key: probe.key,
          id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const failed = targets.length - ok - na;
    ctx.log(
      `  ${probe.key.padEnd(38)} ${ok}/${targets.length} ok` +
        (na > 0 ? `  ${na} n/a` : '') +
        (failed > 0 ? `  ${failed} FAILED` : ''),
    );
  }
  return outcomes;
};

/**
 * Group failures so one broken thing reads as ONE finding rather than one per
 * sampled row. Nested maps rather than a joined string key, because any
 * separator character could legitimately appear inside a GraphQL error message.
 */
export const report = (
  outcomes: readonly ProbeOutcome[],
  log: (msg: string) => void,
): boolean => {
  const notApplicable = outcomes.filter((o) => o.notApplicable);
  const failures = outcomes.filter((o) => !o.ok && !o.notApplicable);
  const passed = outcomes.filter((o) => o.ok);
  log(
    `\n--- Result ---\n` +
      `${outcomes.length} attempts, ${passed.length} ok, ` +
      `${failures.length} failed, ${notApplicable.length} not applicable`,
  );

  // Always spelled out. A row that could not answer the question is not a pass,
  // and burying it in a total is how a check quietly stops checking.
  if (notApplicable.length > 0) {
    const reasons = new Map<string, number>();
    for (const o of notApplicable) {
      const r = `${o.key}: ${o.notApplicable!}`;
      reasons.set(r, (reasons.get(r) ?? 0) + 1);
    }
    log(`\n--- Not applicable ---`);
    for (const [reason, count] of reasons) log(`  ${count} x ${reason}`);
  }

  if (failures.length === 0) {
    log('\nEvery applicable probe wrote to a migrated row and read it back.');
    return true;
  }

  const byKey = new Map<string, Map<string, ProbeOutcome[]>>();
  for (const f of failures) {
    const byMessage = byKey.get(f.key) ?? new Map<string, ProbeOutcome[]>();
    // The row's own id usually appears in the message, which would make three
    // instances of ONE broken thing read as three separate findings. Replacing
    // it collapses them, and the placeholder keeps the message readable.
    const message = (f.error ?? '(no message)').replaceAll(f.id, '<id>');
    byMessage.set(message, [...(byMessage.get(message) ?? []), f]);
    byKey.set(f.key, byMessage);
  }
  const distinct = [...byKey.values()].reduce((n, m) => n + m.size, 0);
  log(`\n--- Failures (${distinct} distinct) ---`);
  for (const [key, byMessage] of byKey) {
    for (const [message, list] of byMessage) {
      log(`\n${key} - ${list.length} row(s)`);
      log(`  ${message}`);
      log(
        `  e.g. ${list
          .slice(0, 5)
          .map((f) => f.id)
          .join(', ')}`,
      );
    }
  }
  return false;
};
