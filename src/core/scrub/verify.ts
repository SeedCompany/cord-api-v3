import { type Client } from 'pg';
import {
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
  NAME_POOLS,
  splitExtension,
  splitOrdinal,
  usesRegistry,
} from './entity-name';
import { forEachPage, ident, readLiveColumns } from './live-schema';
import { GIVEN_NAMES, SURNAMES } from './theme';

/**
 * The independent check that the scrub worked.
 *
 * Deliberately **not** built from the scrub's own bookkeeping. A scrub that
 * silently skipped a column would report success and its own counts would
 * agree with it. This re-reads the database and looks for values that still
 * look real, so a missed column shows up as a number rather than as silence.
 *
 * REPORTS COUNTS, NEVER VALUES. That is what makes the result safe to paste
 * into a conversation, a ticket, or a CI log.
 *
 * Each probe is written to catch the shape of *real* data, or to assert the
 * CLOSED SET fake data is drawn from — never to validate that fake data looks
 * fake, which an empty database would pass. Run against an unscrubbed copy it
 * reports large numbers; that is the negative control, and the spec in
 * `classification.spec.ts` keeps the probes paired to the strategies.
 */

export interface Violation {
  readonly field: string;
  readonly probe: string;
  readonly count: number;
}

export interface VerifyReport {
  readonly violations: readonly Violation[];
  readonly watchlist: readonly Violation[];
  readonly clean: boolean;
}

/** Long free-text runs inside the spreadsheet-context column left unscrubbed. */
const FREE_TEXT_RUN = 200;

/**
 * SQL predicates matching a value that still looks real, per strategy. `col`
 * is the quoted column; `$1` (where used) is the pool as a text array.
 */
const PROBES: Partial<
  Record<
    Strategy,
    {
      readonly where: (col: string) => string;
      readonly pool?: readonly string[];
      readonly describes: string;
    }
  >
> = {
  email: {
    where: (col) => `${col} <> '' and ${col} !~ '@example\\.invalid$'`,
    describes: 'email not on example.invalid',
  },
  phone: {
    where: (col) => `${col} ~ '[0-9]{3}[^0-9]?[0-9]{4}' and ${col} !~ '555 01'`,
    describes: 'phone-shaped and not in the reserved block',
  },
  // The strongest probes: names are the one category whose correct output is a
  // CLOSED SET, so a real name cannot help but fall outside it. Blanks are
  // allowed — `fakeValue` leaves a blank blank, deliberately.
  givenName: {
    where: (col) => `${col} <> '' and not (${col} = any($1::text[]))`,
    pool: GIVEN_NAMES,
    describes: 'given-name column holding a name outside the reviewed pool',
  },
  surname: {
    where: (col) => `${col} <> '' and not (${col} = any($1::text[]))`,
    pool: SURNAMES,
    describes: 'surname column holding a name outside the reviewed pool',
  },
  languageName: {
    where: (col) => `${col} <> '' and not (${col} = any($1::text[]))`,
    pool: NAME_POOLS.languageName,
    describes: 'language name outside the reviewed pool',
  },
  // Generated prose is letters, spaces and periods only. Real text almost always
  // carries a digit, a comma, an apostrophe, a newline or a non-ASCII letter.
  prose: {
    where: (col) => `${col} !~ '^[A-Za-z .]*$'`,
    describes:
      'text with characters generated prose never has (digits, punctuation, non-ASCII)',
  },
  uniqueProse: {
    where: (col) => `${col} !~ '^[A-Za-z .]* [0-9a-f]{10}$'`,
    describes: 'text without the generated-prose shape and digest tag',
  },
  entityName: {
    where: (col) => `${col} !~ ' [0-9a-f]{10}$'`,
    describes: 'entity name without its digest tag',
  },
  acronym: {
    where: (col) => `${col} !~ '^[A-Z]*$'`,
    describes: 'acronym with characters other than uppercase letters',
  },
  address: {
    where: (col) =>
      `${col} !~ '^[^,]+, [^,]+$' or position(E'\\n' in ${col}) > 0`,
    describes: 'address not in the generated "street, city" shape',
  },
  richText: {
    where: (col) =>
      `jsonb_typeof(${col}::jsonb) <> 'object' or not (${col}::jsonb ? 'blocks')`,
    describes: 'rich-text column not holding a block document',
  },
};

const label = (table: SchemaTable, column: SchemaColumn) =>
  `${table.name}.${column.name}`;

/** The stem `composeHashedName` replaced, read back out of a file name. */
const fileStem = (name: string): string => {
  const { stem } = splitExtension(name);
  return name.startsWith('.') ? stem.slice(1) : stem;
};

/**
 * Themed names outside their pool, counted in Node so `splitOrdinal` and
 * `splitExtension` are not reimplemented in SQL — two implementations would be
 * two chances to disagree about what a base is.
 */
const countOutsidePools = async (
  client: Client,
  table: SchemaTable,
  column: SchemaColumn,
  action: ColumnAction,
): Promise<ReadonlyMap<ThemedNameStrategy, number>> => {
  const by =
    action.kind === 'perType'
      ? table.columns.find((c) => c.key === action.by)!
      : undefined;
  const pools = new Map(
    (Object.keys(NAME_POOLS) as ThemedNameStrategy[]).map((strategy) => [
      strategy,
      new Set(NAME_POOLS[strategy]),
    ]),
  );
  const outside = new Map<ThemedNameStrategy, number>();
  await forEachPage<Record<string, unknown>>(
    client,
    `select ${ident(column.name)}${by ? `, ${ident(by.name)}` : ''}
       from ${ident(table.name)}
      where ${ident(column.name)} is not null and ${ident(column.name)} <> ''`,
    10_000,
    async (rows) => {
      for (const row of rows) {
        const value = String(row[column.name]);
        const strategy = (
          action.kind === 'perType'
            ? action.types[String(row[by!.name])]
            : action.kind === 'scrub'
              ? action.as
              : undefined
        ) as ThemedNameStrategy | undefined;
        if (!strategy || !(strategy in NAME_POOLS)) continue;
        const key = usesRegistry(strategy)
          ? splitOrdinal(value).base
          : strategy === 'fileName'
            ? fileStem(value)
            : value;
        if (!pools.get(strategy)!.has(key)) {
          outside.set(strategy, (outside.get(strategy) ?? 0) + 1);
        }
      }
    },
  );
  return outside;
};

export const runVerify = async (client: Client): Promise<VerifyReport> => {
  const violations: Violation[] = [];
  const watchlist: Violation[] = [];
  const tables = walkSchema();
  const live = await readLiveColumns(client);
  const count = async (
    sql: string,
    params: unknown[] = [],
  ): Promise<number> => {
    const result = await client.query<{ total: string }>(sql, params);
    return Number(result.rows[0]?.total ?? 0);
  };
  const present = (table: SchemaTable, column?: SchemaColumn) =>
    column
      ? live.get(table.name)?.has(column.name) === true
      : live.has(table.name);

  // Cursors need a transaction; read-only says what kind.
  await client.query('begin read only');
  try {
    for (const table of tables) {
      const action = classification[table.key];

      // Anything the classification says to empty must genuinely be empty.
      if (isTruncate(action)) {
        if (!present(table)) continue;
        const total = await count(
          `select count(*) as total from ${ident(table.name)}`,
        );
        if (total > 0) {
          violations.push({
            field: table.name,
            probe: 'should have been emptied',
            count: total,
          });
        }
        continue;
      }

      for (const [column, columnAction] of columnActionsOf(table)) {
        if (!present(table, column)) continue;
        const field = label(table, column);
        const col = ident(column.name);

        if (columnAction.kind === 'scrub' && columnAction.as === 'credential') {
          // Every hash equals one value after the scrub. Real hashes are all
          // distinct (per-row salt), so "rows not holding the commonest hash"
          // is the count of survivors.
          const total = await count(
            `select coalesce(sum(n) - max(n), 0) as total
               from (select count(*) as n from ${ident(table.name)} group by ${col}) s`,
          );
          if (total > 0) {
            violations.push({
              field,
              probe: 'password hashes differ from the dev hash',
              count: total,
            });
          }
          continue;
        }

        const strategies: Strategy[] =
          columnAction.kind === 'scrub'
            ? [columnAction.as]
            : columnAction.kind === 'perType'
              ? Object.values(columnAction.types)
              : [];
        if (strategies.length === 0) continue;

        // Pooled names: the closed-set probe, in Node.
        if (strategies.some((s) => s in NAME_POOLS && s !== 'languageName')) {
          const outside = await countOutsidePools(
            client,
            table,
            column,
            columnAction,
          );
          for (const [strategy, n] of outside) {
            violations.push({
              field: `${field} (${strategy})`,
              probe: 'themed name whose base is not in the reviewed pool',
              count: n,
            });
          }
          continue;
        }

        for (const strategy of strategies) {
          const probe = PROBES[strategy];
          if (!probe) continue;
          const total = await count(
            `select count(*) as total from ${ident(table.name)}
              where ${col} is not null and (${probe.where(col)})`,
            probe.pool ? [[...probe.pool]] : [],
          );
          if (total > 0) {
            violations.push({ field, probe: probe.describes, count: total });
          }
        }
      }
    }

    // ── Watchlist: measured every refresh, never a failure ───────────────────

    // Directories holding two live children with the same name. File names are
    // hash-assigned (no unique index; the only rule is per directory, in
    // file.service.ts), so a folder can pick up a duplicate. Nothing breaks —
    // only CREATING a file with that exact name in that folder would be
    // refused. The real data has its own baseline of such folders, so read
    // this as a trend, not a target of zero.
    if (live.has('file_nodes')) {
      const total = await count(
        `select count(*) as total from (
           select child.parent_id, child.name
             from file_nodes child
             join file_nodes parent on parent.id = child.parent_id
            where parent.type = 'Directory' and child.deleted_at is null
            group by child.parent_id, child.name
           having count(*) > 1) s`,
      );
      if (total > 0) {
        watchlist.push({
          field: 'file_nodes.name',
          probe:
            'directories holding two live children with the same name (hash-assigned names; a count in the thousands means the pool needs widening)',
          count: total,
        });
      }
    }

    // The spreadsheet-context column left in place by decision. Its values are
    // step labels, book names, dates and cell references; a long value would be
    // free text riding along. Zero closes the question every refresh.
    if (live.get('pnp_extraction_result_problems')?.has('context')) {
      const total = await count(
        `select count(*) as total from pnp_extraction_result_problems
          where exists (select 1 from jsonb_each_text(context) e where length(e.value) > ${FREE_TEXT_RUN})`,
      );
      if (total > 0) {
        watchlist.push({
          field: 'pnp_extraction_result_problems.context',
          probe: `left unscrubbed by decision — rows with a value longer than ${FREE_TEXT_RUN} characters`,
          count: total,
        });
      }
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }

  return { violations, watchlist, clean: violations.length === 0 };
};
