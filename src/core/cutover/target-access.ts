import { sql, type SQL } from 'drizzle-orm';
import { type DrizzleDb } from '../drizzle/drizzle.service';

/**
 * Is anybody else attached to the database we are about to rewrite?
 *
 * A refresh drops the schema and truncates every target table. Doing that to a
 * database somebody is using takes their session out from under them mid-click,
 * and anything they write afterwards lands in a half-loaded database and shows
 * up later as a reconciliation mismatch that looks like a load defect.
 *
 * That is not hypothetical. On 2026-08-25 a production-scale refresh reported
 * thirteen mismatched tables; the cause was a QA user on the site while it ran.
 * The counts told the truth — a handful of extra rows, paired one-to-one across
 * unrelated domains the way only the application creates them — but nothing
 * said why, and the load looked broken for an afternoon.
 *
 * Returns a result rather than throwing so the caller decides how loud to be,
 * and so the reason can be printed verbatim. Same shape and reasoning as the
 * scrub gate in scrub/provenance.ts, which guards the SOURCE; this guards the
 * TARGET.
 */

// The index signature is load-bearing, not decoration: `db.execute<T>`
// constrains T to Record<string, unknown>, and an interface — unlike a type
// alias — gets no implicit one. (Writing this as a type alias also works, but
// the lint rule rewrites it back to an interface, so state it explicitly.)
interface SessionRow {
  readonly [column: string]: unknown;
  readonly application: string;
  readonly client: string;
  readonly state: string;
  readonly sessions: number;
}

export interface OtherSessions {
  readonly allowed: boolean;
  /** Printable, and it names what to do about it — a bare "no" gets worked around. */
  readonly reason: string;
  readonly total: number;
}

export const checkExclusiveTarget = async (
  db: DrizzleDb,
): Promise<OtherSessions> => {
  const self = await db.execute<{ me: string; database: string }>(sql`
    select current_setting('application_name') as me,
           current_database() as database
  `);
  const me = self.rows[0]?.me ?? '';
  const database = self.rows[0]?.database ?? '(unknown)';

  // Our whole pool shares one application_name (set in DrizzleService), so
  // subtracting that name leaves exactly the sessions belonging to someone
  // else. `pid <> pg_backend_pid()` alone would not do: it hides only the one
  // connection this query happens to run on and would report the rest of our
  // own pool as intruders.
  //
  // If the name is somehow empty we fall back to the pid, which cannot tell our
  // other pool connections apart from a stranger's. The caller is told, because
  // a check that quietly got weaker is worse than one that failed.
  const mine: SQL = me
    ? sql`and coalesce(application_name, '') <> ${me}`
    : sql``;

  const found = await db.execute<SessionRow>(sql`
    select
      coalesce(nullif(application_name, ''), '(unnamed)') as application,
      coalesce(host(client_addr), 'local socket') as client,
      coalesce(nullif(state, ''), 'unknown') as state,
      count(*)::int as sessions
    from pg_stat_activity
    where datname = current_database()
      and backend_type = 'client backend'
      and pid <> pg_backend_pid()
      ${mine}
    group by 1, 2, 3
    order by sessions desc, application
  `);

  const rows = found.rows;
  const total = rows.reduce((sum, row) => sum + row.sessions, 0);
  const imprecise = me
    ? ''
    : '\n  (This process has no application_name, so its own pooled ' +
      'connections may be counted above.)';

  if (total === 0) {
    return {
      allowed: true,
      total: 0,
      reason: `"${database}" — no other sessions connected.${imprecise}`,
    };
  }

  const listed = rows
    .map(
      (row) =>
        `  ${row.sessions} × ${row.application} from ${row.client} (${row.state})`,
    )
    .join('\n');

  return {
    allowed: false,
    total,
    reason:
      `${total} other session(s) are connected to "${database}":\n${listed}\n` +
      `Dropping and reloading it now would end those sessions mid-use, and ` +
      `anything they write during the load lands in a half-populated database ` +
      `and reads later as a mismatch. Stop the API pointed at this database ` +
      `(or wait for the person using it), then run again.${imprecise}`,
  };
};
