import { createHash } from 'node:crypto';
import { type Client } from 'pg';
import { classification, type TableAction } from './classification';

/**
 * The scrub marker.
 *
 * "The copy was scrubbed" stops being a promise anybody has to remember and
 * becomes something tooling can check: the scrub writes one row here on
 * success, and anything that loads a dump (`yarn db:seed`, when it lands) can
 * refuse a dump without it. A Postgres dump carries nothing else that says
 * whether it was scrubbed — the themed names are plausible by design.
 *
 * The table is created by this tool, not by a migration, and the application
 * never reads it. It travels inside the dump because it lives in `public`.
 */
export const PROVENANCE_TABLE = 'scrub_provenance';

export interface Provenance {
  readonly scrubbedAt: Date;
  readonly classificationHash: string;
  readonly toolCommit: string | null;
  readonly sourceLabel: string | null;
  readonly valuesReplaced: number;
  readonly credentialsCleared: number;
  readonly rowsTruncated: number;
}

/**
 * Hash of the classification's DECISIONS, recorded with the marker so a copy
 * scrubbed under older rules is identifiable after the rules change — "was this
 * scrubbed?" is a less useful question than "was it scrubbed under the rules we
 * have now?".
 *
 * Hashes the data, not the source file, so reformatting or rewording a comment
 * does not invalidate every existing copy while genuinely reclassifying a
 * column does. Sorted, so key order in the file cannot change it either.
 */
export const classificationHash = (): string => hashDecisions(classification);

export const hashDecisions = (
  decisions: Readonly<Partial<Record<string, TableAction>>>,
): string => {
  const canonical = Object.entries(decisions)
    .filter((entry): entry is [string, TableAction] => entry[1] !== undefined)
    .flatMap(([table, action]) =>
      'truncate' in action
        ? [`${table}:truncate`]
        : Object.entries(action.columns).map(
            ([column, columnAction]) =>
              `${table}.${column}:${JSON.stringify(columnAction)}`,
          ),
    )
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join('\n');
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
};

const tableExists = async (client: Client): Promise<boolean> => {
  const result = await client.query<{ exists: boolean }>(
    `select to_regclass($1) is not null as exists`,
    [`public.${PROVENANCE_TABLE}`],
  );
  return result.rows[0]?.exists ?? false;
};

export const readProvenance = async (
  client: Client,
): Promise<Provenance | undefined> => {
  if (!(await tableExists(client))) return undefined;
  const result = await client.query<{
    scrubbedAt: Date;
    classificationHash: string;
    toolCommit: string | null;
    sourceLabel: string | null;
    valuesReplaced: string;
    credentialsCleared: string;
    rowsTruncated: string;
  }>(
    `select scrubbed_at as "scrubbedAt", classification_hash as "classificationHash",
            tool_commit as "toolCommit", source_label as "sourceLabel",
            values_replaced as "valuesReplaced", credentials_cleared as "credentialsCleared",
            rows_truncated as "rowsTruncated"
       from ${PROVENANCE_TABLE} order by scrubbed_at desc limit 1`,
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    ...row,
    valuesReplaced: Number(row.valuesReplaced),
    credentialsCleared: Number(row.credentialsCleared),
    rowsTruncated: Number(row.rowsTruncated),
  };
};

/**
 * Append a marker row. Appended rather than replaced so a copy that was
 * scrubbed twice says so — `readProvenance` returns the newest.
 */
export const stampProvenance = async (
  client: Client,
  stats: Omit<Provenance, 'scrubbedAt' | 'classificationHash'>,
): Promise<void> => {
  await client.query(`
    create table if not exists ${PROVENANCE_TABLE} (
      scrubbed_at timestamptz not null,
      classification_hash text not null,
      tool_commit text,
      source_label text,
      values_replaced bigint not null,
      credentials_cleared bigint not null,
      rows_truncated bigint not null
    )
  `);
  await client.query(
    `insert into ${PROVENANCE_TABLE}
       (scrubbed_at, classification_hash, tool_commit, source_label,
        values_replaced, credentials_cleared, rows_truncated)
     values (now(), $1, $2, $3, $4, $5, $6)`,
    [
      classificationHash(),
      stats.toolCommit,
      stats.sourceLabel,
      stats.valuesReplaced,
      stats.credentialsCleared,
      stats.rowsTruncated,
    ],
  );
};
