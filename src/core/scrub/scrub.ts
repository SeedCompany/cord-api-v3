import { chunk } from 'lodash';
import { type Client } from 'pg';
import {
  auditClassification,
  classification,
  type ColumnAction,
  columnActionsOf,
  isTruncate,
  type SchemaColumn,
  type SchemaTable,
  type Strategy,
  type ThemedNameStrategy,
  walkSchema,
} from './classification';
import {
  buildNameRegistry,
  composeHashedName,
  composeThemedName,
  emptyCensus,
  findPoolShortfalls,
  NAME_POOLS,
  type ShapeCensus,
  splitOrdinal,
  usesRegistry,
} from './entity-name';
import { type Fake, fakeValue } from './fake';
import {
  assertScrubDatabase,
  forEachPage,
  ident,
  isFreeTextType,
  type LiveColumn,
  readLiveColumns,
} from './live-schema';
import { readProvenance, stampProvenance } from './provenance';

/**
 * The scrub itself: one transaction over a restored production copy.
 *
 * Runs in four passes, in this order and for this reason:
 *
 *  1. **Credentials.** Every password hash becomes the hash of one known
 *     development password, so the copy can be logged into.
 *  2. **Truncation.** Sessions, reset tokens, webhooks and the audit trail are
 *     emptied — the one category where a plausible fake is worse than nothing.
 *  3. **Registries.** A read-only pass over every uniquely indexed name column,
 *     so each distinct name base can be assigned a distinct themed title BEFORE
 *     any row is written (`entity-name.ts`).
 *  4. **Values.** Every other classified column, table by table, through a
 *     server-side cursor and batched `UPDATE … FROM (VALUES …)`.
 *
 * ONE TRANSACTION, deliberately. An interrupted run rolls back to the raw
 * restore, which is honest: there is no such thing as a partly scrubbed copy
 * that looks clean. A `--dry-run` does every read and computation and then
 * rolls back, so its counts are the real ones.
 *
 * Soft-deleted rows are scrubbed too — nothing here filters on `deleted_at`.
 * The history of what a field used to say is exactly what a scrub exists to
 * cover.
 */

export interface ScrubContext {
  readonly client: Client;
  /** Rows per cursor fetch; UPDATE statements are chunked below this as needed. */
  readonly batchSize: number;
  readonly log: (msg: string) => void;
  /**
   * Hash to write into every password column — one known development value,
   * computed by the caller with the app's own argon2 settings.
   */
  readonly devPasswordHash: string;
  /** When true, read and count everything, write nothing, roll back. */
  readonly dryRun: boolean;
  /** Free text recorded in the marker, e.g. "prod snapshot 2026-10-14". */
  readonly sourceLabel: string | null;
  readonly toolCommit: string | null;
}

export interface ScrubReport {
  readonly valuesReplaced: number;
  readonly credentialsCleared: number;
  readonly rowsTruncated: number;
  readonly perColumn: ReadonlyArray<{
    readonly column: string;
    readonly replaced: number;
  }>;
}

const isThemed = (strategy: Strategy): strategy is ThemedNameStrategy =>
  strategy in NAME_POOLS;

/** Postgres allows 65,535 bind parameters per statement; stay well under. */
const MAX_PARAMS_PER_STATEMENT = 60_000;

const format = (n: number) => n.toLocaleString('en-US');

type Target = readonly [SchemaColumn, ColumnAction];

/** The strategy one row's value takes under this column's action. */
const strategyFor = (
  action: ColumnAction,
  row: Record<string, unknown>,
  table: SchemaTable,
): Strategy => {
  if (action.kind === 'scrub') return action.as;
  if (action.kind !== 'perType') {
    throw new Error(`Column action '${action.kind}' has no strategy`);
  }
  const by = table.columns.find((c) => c.key === action.by)!;
  const type = row[by.name];
  const strategy = action.types[String(type)];
  if (!strategy) {
    // Cannot happen once `auditClassification` has passed — every enum value is
    // routed — unless the database holds a value the enum does not have.
    throw new Error(
      `${table.name}.${by.name} = '${String(type)}' is not routed to a strategy`,
    );
  }
  return strategy;
};

/** `table.column` for the report and the log. */
const label = (table: SchemaTable, column: SchemaColumn) =>
  `${table.name}.${column.name}`;

/**
 * What the live database has that the code does not know about, and the
 * reverse. The first is a hard stop: a dump from a newer production carries
 * columns nobody has classified. The second is only a warning: an older dump
 * lacks columns the scrub would have handled, and those are skipped.
 */
const compareLive = (
  tables: readonly SchemaTable[],
  live: ReadonlyMap<string, ReadonlyMap<string, LiveColumn>>,
) => {
  const problems: string[] = [];
  const warnings: string[] = [];
  const present = new Set<string>();
  const knownTables = new Map(tables.map((t) => [t.name, t]));

  for (const [tableName, columns] of live) {
    const table = knownTables.get(tableName);
    if (!table) {
      const freeText = [...columns.values()].filter((c) =>
        isFreeTextType(c.dataType),
      );
      if (freeText.length > 0) {
        problems.push(
          `table "${tableName}" is in the database but not in the Drizzle schema ` +
            `(free-text columns: ${freeText.map((c) => c.column).join(', ')})`,
        );
      } else {
        warnings.push(
          `table "${tableName}" is not in the Drizzle schema (no free-text columns; ignored)`,
        );
      }
      continue;
    }
    const knownColumns = new Set(table.columns.map((c) => c.name));
    for (const column of columns.values()) {
      if (!knownColumns.has(column.column) && isFreeTextType(column.dataType)) {
        problems.push(
          `${tableName}.${column.column} (${column.dataType}) is in the database but not in the Drizzle schema`,
        );
      }
    }
  }

  for (const table of tables) {
    const columns = live.get(table.name);
    if (!columns) {
      warnings.push(
        `table "${table.name}" is not in the database (older dump?) — skipped`,
      );
      continue;
    }
    for (const column of table.columns) {
      if (columns.has(column.name)) {
        present.add(label(table, column));
      } else {
        warnings.push(
          `${label(table, column)} is not in the database (older dump?) — skipped`,
        );
      }
    }
  }
  return { problems, warnings, present };
};

export const runScrub = async (ctx: ScrubContext): Promise<ScrubReport> => {
  const { client, log } = ctx;
  const database = await assertScrubDatabase(client);

  // ── Guard 1: the classification agrees with the schema ───────────────────
  // The same check `classification.spec.ts` runs. Repeated here because the
  // compiled tool may be older or newer than the test that last passed.
  const audit = auditClassification();
  if (audit.length > 0) {
    throw new Error(
      `Refusing to scrub — ${audit.length} unresolved item(s). Decide each in ` +
        `src/core/scrub/classification.ts, then re-run:\n  ${audit.join('\n  ')}`,
    );
  }

  // ── Guard 2: the database agrees with the schema ─────────────────────────
  // A column the code does not know about is a column nobody classified.
  const tables = walkSchema();
  const live = await readLiveColumns(client);
  const { problems, warnings, present } = compareLive(tables, live);
  if (problems.length > 0) {
    throw new Error(
      `Refusing to scrub "${database}" — it holds ${problems.length} column(s) ` +
        `this code does not know about. Update the Drizzle schema and the ` +
        `classification (or scrub from a branch that has them), then re-run:\n  ` +
        problems.join('\n  '),
    );
  }
  for (const warning of warnings) log(`  ⚠ ${warning}`);
  log(
    `Classification covers all ${tables.length} tables of "${database}" ` +
      `(${live.size} tables in the database).\n`,
  );

  // ── A re-scrub DEGRADES the copy, so say so before doing one ──────────────
  // Every generator is a pure function of the value it replaces, so a second
  // pass reads the FIRST pass's output and distinctness can only shrink from
  // there (measured 2026-09-01: surnames in use 149 → 101). A pool or strategy
  // change cannot be evaluated on an already-scrubbed copy — restore fresh.
  const existing = await readProvenance(client);
  if (existing) {
    log(
      `⚠ ALREADY SCRUBBED ${existing.scrubbedAt.toISOString()} (classification ` +
        `${existing.classificationHash}, ${format(existing.valuesReplaced)} values).\n` +
        `  Re-scrubbing replaces fakes with fakes OF fakes, and distinctness\n` +
        `  only shrinks. If you changed a pool or a strategy, restore a fresh\n` +
        `  copy and scrub that instead.\n`,
    );
  }

  const perColumn: Array<{ column: string; replaced: number }> = [];
  let valuesReplaced = 0;
  let credentialsCleared = 0;
  let rowsTruncated = 0;

  const count = async (sql: string): Promise<number> => {
    const result = await client.query<{ total: string }>(sql);
    return Number(result.rows[0]?.total ?? 0);
  };

  await client.query('begin');
  try {
    // Triggers off for this transaction: the one user trigger in the schema
    // syncs project steps from workflow events, and any future `modified_at`
    // trigger would rewrite real timestamps with the scrub's own. Needs
    // superuser (or rds_superuser); say so rather than silently shifting dates.
    try {
      await client.query(`set local session_replication_role = 'replica'`);
    } catch (error) {
      log(
        `  ⚠ Could not disable triggers for this session (${
          error instanceof Error ? error.message : String(error)
        }). Any trigger-maintained timestamps will move.`,
      );
    }

    // ── Pass 1: credentials ──────────────────────────────────────────────────
    log('Pass 1 — credentials');
    for (const table of tables) {
      for (const [column, action] of columnActionsOf(table)) {
        if (action.kind !== 'scrub' || action.as !== 'credential') continue;
        if (!present.has(label(table, column))) continue;
        const total = await count(
          `select count(*) as total from ${ident(table.name)} where ${ident(column.name)} is not null`,
        );
        if (!ctx.dryRun && total > 0) {
          await client.query(
            `update ${ident(table.name)} set ${ident(column.name)} = $1 where ${ident(column.name)} is not null`,
            [ctx.devPasswordHash],
          );
        }
        credentialsCleared += total;
        perColumn.push({ column: label(table, column), replaced: total });
        log(`  ${label(table, column)}: ${format(total)} → dev password`);
      }
    }

    // ── Pass 2: truncation ───────────────────────────────────────────────────
    log('\nPass 2 — tables emptied');
    const toTruncate = tables.filter(
      (table) => isTruncate(classification[table.key]) && live.has(table.name),
    );
    for (const table of toTruncate) {
      const total = await count(
        `select count(*) as total from ${ident(table.name)}`,
      );
      rowsTruncated += total;
      log(`  ${table.name}: ${format(total)}`);
    }
    if (!ctx.dryRun && toTruncate.length > 0) {
      // One statement, so tables that reference each other go together.
      await client.query(
        `truncate table ${toTruncate.map((t) => ident(t.name)).join(', ')}`,
      );
    }

    // ── Pass 3: themed-name registries ───────────────────────────────────────
    // A read-only pass over every registry column, collecting the distinct
    // BASES of its names so each can be assigned a distinct title. Up front,
    // and seeing everything: these columns are UNIQUE, so the assignment cannot
    // be made one page at a time without risking two bases landing on one
    // title and aborting the UPDATE.
    log('\nPass 3 — themed entity-name registries');
    const basesByStrategy = new Map<ThemedNameStrategy, Set<string>>();
    const censusByStrategy = new Map<ThemedNameStrategy, ShapeCensus>();
    for (const table of tables) {
      for (const [column, action] of columnActionsOf(table)) {
        if (!present.has(label(table, column))) continue;
        const strategies =
          action.kind === 'scrub'
            ? [action.as]
            : action.kind === 'perType'
              ? Object.values(action.types)
              : [];
        if (!strategies.some((s) => isThemed(s) && usesRegistry(s))) continue;
        const by =
          action.kind === 'perType'
            ? table.columns.find((c) => c.key === action.by)!
            : undefined;
        const rows = await client.query<Record<string, unknown>>(
          `select distinct ${ident(column.name)}${by ? `, ${ident(by.name)}` : ''}
             from ${ident(table.name)} where ${ident(column.name)} is not null`,
        );
        for (const row of rows.rows) {
          const strategy = strategyFor(action, row, table);
          if (!isThemed(strategy) || !usesRegistry(strategy)) continue;
          const value = row[column.name];
          if (typeof value !== 'string') continue;
          const { base, shape } = splitOrdinal(value);
          let bases = basesByStrategy.get(strategy);
          if (!bases) basesByStrategy.set(strategy, (bases = new Set()));
          bases.add(base);
          let census = censusByStrategy.get(strategy);
          if (!census) censusByStrategy.set(strategy, (census = emptyCensus()));
          census[shape] += 1;
        }
      }
    }

    // Every too-small pool at once, BEFORE any name is written — a shortfall
    // found halfway through pass 4 costs a fresh restore to retry.
    const shortfalls = findPoolShortfalls(basesByStrategy);
    if (shortfalls.length > 0) {
      throw new Error(
        `Refusing to scrub — ${shortfalls.length} name pool(s) cannot cover the ` +
          `data. Widen each in src/core/scrub/theme.ts and re-run:\n  ` +
          shortfalls
            .map(
              ({ strategy, distinctBases, poolSize }) =>
                `${strategy}: ${distinctBases} distinct bases > ${poolSize} entries`,
            )
            .join('\n  '),
      );
    }
    const registries = new Map<
      ThemedNameStrategy,
      ReadonlyMap<string, string>
    >();
    for (const [strategy, bases] of basesByStrategy) {
      registries.set(strategy, buildNameRegistry(strategy, bases));
    }
    for (const strategy of Object.keys(NAME_POOLS) as ThemedNameStrategy[]) {
      if (!usesRegistry(strategy)) continue;
      const bases = basesByStrategy.get(strategy);
      if (!bases) {
        log(`  ⚠ ${strategy}: 0 values — no row of that type was seen`);
        continue;
      }
      const census = censusByStrategy.get(strategy)!;
      const values = Object.values(census).reduce((a, b) => a + b, 0);
      log(
        `  ${strategy}: ${format(values)} distinct values · ${format(bases.size)} bases → ` +
          `${format(registries.get(strategy)!.size)} assigned of ${format(NAME_POOLS[strategy].length)} · ` +
          Object.entries(census)
            .filter(([, n]) => n > 0)
            .map(([shape, n]) => `${shape}=${n}`)
            .join(' '),
      );
    }

    /**
     * The replacement for one value: themed if its strategy is pooled, generic
     * if not. The registry is looked up rather than asserted — a registry
     * strategy whose every value was a non-string got no registry in pass 3,
     * and the only correct answer then is to refuse, not to leave a real name.
     */
    const replace = (
      strategy: Strategy,
      original: unknown,
      rowKey: string | null,
    ): Fake => {
      if (isThemed(strategy)) {
        if (typeof original !== 'string') {
          throw new Error(
            `Themed strategy '${strategy}' received a non-string`,
          );
        }
        if (!usesRegistry(strategy)) {
          return composeHashedName(strategy, original);
        }
        const registry = registries.get(strategy);
        if (!registry) {
          throw new Error(`No registry was built for '${strategy}'`);
        }
        return composeThemedName(registry, original);
      }
      return fakeValue(strategy, original, rowKey);
    };

    // ── Pass 4: values ───────────────────────────────────────────────────────
    log('\nPass 4 — values replaced');
    for (const table of tables) {
      const targets: Target[] = columnActionsOf(table).filter(
        ([column, action]) =>
          present.has(label(table, column)) &&
          ((action.kind === 'scrub' && action.as !== 'credential') ||
            action.kind === 'perType'),
      );
      if (targets.length === 0) continue;

      const idColumn = table.columns.find((c) => c.name === 'id');
      const discriminators = [
        ...new Set(
          targets.flatMap(([, action]) =>
            action.kind === 'perType'
              ? [table.columns.find((c) => c.key === action.by)!.name]
              : [],
          ),
        ),
      ];
      const selected = [
        'ctid::text as row_ctid',
        ...(idColumn ? [ident(idColumn.name)] : []),
        ...discriminators.map(ident),
        ...targets.map(([column]) => ident(column.name)),
      ];
      // Only rows with something to replace: a 212k-row table whose one
      // classified column is null almost everywhere is read in a moment and
      // never rewritten.
      const query =
        `select ${selected.join(', ')} from ${ident(table.name)} where ` +
        targets
          .map(([column]) => `${ident(column.name)} is not null`)
          .join(' or ');

      const replaced = new Map<SchemaColumn, number>(
        targets.map(([column]) => [column, 0]),
      );
      const rowsPerStatement = Math.max(
        1,
        Math.min(
          ctx.batchSize,
          Math.floor(MAX_PARAMS_PER_STATEMENT / (targets.length + 1)),
        ),
      );

      const toUpdates = (page: ReadonlyArray<Record<string, unknown>>) =>
        page.map((row) => {
          const rowKey = idColumn ? String(row[idColumn.name]) : null;
          const values = targets.map(([column, action]) => {
            const original = row[column.name];
            if (original === null || original === undefined) return null;
            replaced.set(column, replaced.get(column)! + 1);
            return replace(strategyFor(action, row, table), original, rowKey);
          });
          return { ctid: String(row.row_ctid), id: rowKey, values };
        });

      const registryColumns = targets
        .filter(([, action]) =>
          (action.kind === 'scrub'
            ? [action.as]
            : Object.values(action.types)
          ).some((s) => isThemed(s) && usesRegistry(s)),
        )
        .map(([column]) => column);

      let rows: number;
      if (registryColumns.length === 0) {
        rows = await forEachPage<Record<string, unknown>>(
          client,
          query,
          ctx.batchSize,
          async (page) => {
            if (ctx.dryRun) {
              toUpdates(page);
              return;
            }
            for (const batch of chunk(toUpdates(page), rowsPerStatement)) {
              await writeBatch(client, table, targets, batch, 'ctid');
            }
          },
        );
      } else {
        // A registry column sits under a partial UNIQUE index, and a single
        // UPDATE checks that index row by row — so if row A's NEW name equals
        // row B's CURRENT name (which happens on an already-scrubbed copy,
        // where the current names are pool entries), the statement fails on a
        // duplicate that would not exist once it finished. Two steps instead:
        // every name becomes a placeholder nothing else can equal, then the
        // final names go in. Keyed on `id`, because the first step moves the
        // rows' ctids. Read in full rather than paged: a uniquely indexed name
        // table holds a few thousand rows, never a million.
        if (!idColumn) {
          throw new Error(
            `${table.name} has a registry column but no "id" column to key the two-step write on`,
          );
        }
        const all = await client.query<Record<string, unknown>>(query);
        rows = all.rows.length;
        const updates = toUpdates(all.rows);
        if (!ctx.dryRun) {
          for (const column of registryColumns) {
            await client.query(
              `update ${ident(table.name)} set ${ident(column.name)} = '~' || ${ident(idColumn.name)}
                where ${ident(column.name)} is not null`,
            );
          }
          for (const batch of chunk(updates, rowsPerStatement)) {
            await writeBatch(client, table, targets, batch, 'id');
          }
        }
      }

      const parts = targets.map(
        ([column, action]) =>
          `${column.name} ${format(replaced.get(column)!)} → ${
            action.kind === 'perType'
              ? `by ${action.by}`
              : action.kind === 'scrub'
                ? action.as
                : action.kind
          }`,
      );
      log(`  ${table.name} (${format(rows)} rows): ${parts.join(' · ')}`);
      for (const [column, n] of replaced) {
        valuesReplaced += n;
        perColumn.push({ column: label(table, column), replaced: n });
      }
    }

    if (ctx.dryRun) {
      await client.query('rollback');
    } else {
      await stampProvenance(client, {
        toolCommit: ctx.toolCommit,
        sourceLabel: ctx.sourceLabel,
        valuesReplaced,
        credentialsCleared,
        rowsTruncated,
      });
      await client.query('commit');
    }
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }

  return { valuesReplaced, credentialsCleared, rowsTruncated, perColumn };
};

/**
 * One `UPDATE … FROM (VALUES …)` for a chunk of rows.
 *
 * Matched on `ctid` by default, and the choice is correctness rather than
 * taste: not every table has a single-column primary key, and inside one
 * transaction on a single connection the ctid the cursor returned still names
 * the row until this statement rewrites it — and the cursor never serves it
 * again. Nothing else is writing to a `cord_scrub_*` database. The two-step
 * write for uniquely indexed names matches on `id` instead, because its first
 * step has already moved the rows.
 */
const writeBatch = async (
  client: Client,
  table: SchemaTable,
  targets: readonly Target[],
  updates: ReadonlyArray<{
    readonly ctid: string;
    readonly id: string | null;
    readonly values: readonly Fake[];
  }>,
  keyOn: 'ctid' | 'id',
): Promise<void> => {
  const params: unknown[] = [];
  const tuples = updates.map((update) => {
    const placeholders =
      keyOn === 'ctid'
        ? [`$${params.push(update.ctid)}::tid`]
        : [`$${params.push(update.id)}::text`];
    targets.forEach(([column], index) => {
      const value = update.values[index] ?? null;
      const cast = column.isJson
        ? column.columnType === 'PgJson'
          ? 'json'
          : 'jsonb'
        : 'text';
      params.push(
        value === null ? null : column.isJson ? JSON.stringify(value) : value,
      );
      placeholders.push(`$${params.length}::${cast}`);
    });
    return `(${placeholders.join(', ')})`;
  });
  const columns = targets.map(([column]) => ident(column.name));
  const key = keyOn === 'ctid' ? 'target.ctid' : 'target."id"';
  await client.query(
    `update ${ident(table.name)} as target
        set ${columns.map((c) => `${c} = v.${c}`).join(', ')}
       from (values ${tuples.join(', ')}) as v(row_key, ${columns.join(', ')})
      where ${key} = v.row_key`,
    params,
  );
};
