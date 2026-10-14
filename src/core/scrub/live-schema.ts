import { type Client } from 'pg';
import { PROVENANCE_TABLE } from './provenance';

/** Helpers shared by the scrub and the verify pass for talking to the live database. */

/** Double-quote an identifier. Names come from the Drizzle schema, never from input. */
export const ident = (name: string): string => `"${name.replace(/"/g, '""')}"`;

/**
 * Only a database named like this may be scrubbed. The scrub rewrites whatever
 * it is pointed at, in place, and a copy and the original are identical in
 * content — the connection string is the only thing that tells them apart.
 * Requiring the prefix means a mistyped `POSTGRES_URL` hits a refusal, not a
 * developer's `cord` database and not production.
 */
export const SCRUB_DB_PREFIX = 'cord_scrub_';

export const currentDatabase = async (client: Client): Promise<string> => {
  const result = await client.query<{ name: string }>(
    'select current_database() as name',
  );
  return result.rows[0]!.name;
};

export const assertScrubDatabase = async (client: Client): Promise<string> => {
  const name = await currentDatabase(client);
  if (!name.startsWith(SCRUB_DB_PREFIX)) {
    throw new Error(
      `Refusing to scrub database "${name}": only a database whose name starts ` +
        `with "${SCRUB_DB_PREFIX}" may be scrubbed. Restore the dump into one ` +
        `(e.g. ${SCRUB_DB_PREFIX}$(date +%Y%m%d)) and point POSTGRES_URL there.`,
    );
  }
  return name;
};

export interface LiveColumn {
  readonly table: string;
  readonly column: string;
  readonly dataType: string;
}

/**
 * Every column in the `public` schema of the connected database, so the scrub
 * can compare what the database HAS against what the code KNOWS. The marker
 * table is this tool's own and is left out.
 */
export const readLiveColumns = async (
  client: Client,
): Promise<ReadonlyMap<string, ReadonlyMap<string, LiveColumn>>> => {
  const result = await client.query<LiveColumn>(
    `select table_name as "table", column_name as "column", data_type as "dataType"
       from information_schema.columns
      where table_schema = 'public' and table_name <> $1
      order by table_name, ordinal_position`,
    [PROVENANCE_TABLE],
  );
  const tables = new Map<string, Map<string, LiveColumn>>();
  for (const row of result.rows) {
    let columns = tables.get(row.table);
    if (!columns) tables.set(row.table, (columns = new Map()));
    columns.set(row.column, row);
  }
  return tables;
};

/** Postgres types that can hold free text. */
export const isFreeTextType = (dataType: string): boolean =>
  ['text', 'character varying', 'character', 'json', 'jsonb', 'ARRAY'].includes(
    dataType,
  );

/**
 * Read a query in pages through a server-side cursor, inside the caller's
 * transaction. Bounds memory to one page, and — because Postgres cursors are
 * insensitive — a row updated after it was fetched is never served again, so
 * the scrub can read and rewrite the same table without a keyset. Tables with
 * composite or no primary key need nothing special.
 */
export const forEachPage = async <Row extends object>(
  client: Client,
  query: string,
  pageSize: number,
  handle: (rows: readonly Row[]) => Promise<void>,
): Promise<number> => {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error(`Page size must be a positive integer (got ${pageSize})`);
  }
  const cursor = 'scrub_cursor';
  await client.query(`declare ${cursor} no scroll cursor for ${query}`);
  let total = 0;
  try {
    let fetched = 0;
    do {
      const page = await client.query<Row>(
        `fetch forward ${pageSize} from ${cursor}`,
      );
      fetched = page.rows.length;
      if (fetched > 0) {
        await handle(page.rows);
        total += fetched;
      }
      // A short page means the end.
    } while (fetched === pageSize);
  } finally {
    // After a failed statement the transaction is aborted and this close
    // fails too; swallowing that keeps the ORIGINAL error as the one reported.
    await client.query(`close ${cursor}`).catch(() => undefined);
  }
  return total;
};
