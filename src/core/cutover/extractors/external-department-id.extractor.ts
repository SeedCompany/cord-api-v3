import { type ID } from '~/common';
import { externalDepartmentIds } from '~/core/drizzle/schema';
import {
  bulkInsert,
  cypher,
  fetchIds,
  recordReadLoss,
  stat,
  tsReq,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * ExternalDepartmentId — the department IDs that already exist in Intacct, the
 * accounting system, and so must never be handed out to a CORD project.
 *
 * Carried, not dropped (Rob, 2026-08-25, after confirming with the team that
 * Intacct is still in use and the reservations still stand). These nodes are
 * fully disconnected — no edges in either direction — which is exactly what
 * made them look retired on a first pass. They are not: the department-ID
 * allocator has unioned them into the unavailable set since 2025-09, and
 * measured against this snapshot, 389 of the 565 sit inside blocks projects are
 * assigned from, with two of thirteen blocks landing on a different ID without
 * them.
 *
 * No `dependsOn`. A reservation list has nothing to depend on: nothing points
 * at these rows and they point at nothing, so there is no landing check to make
 * and no row can be orphaned by another domain failing.
 *
 * The source `id` is deliberately not carried. It is an `apoc.create.uuid()`
 * value invented by the one-off import, referenced by nothing; the department
 * ID is the identity and the target's primary key. It is still read here, so
 * that enumeration can be reconciled against what was actually hydrated.
 */
interface Row {
  id: ID;
  departmentId: string | null;
  name: string | null;
  createdAt: unknown;
}

export const externalDepartmentIdExtractor: Extractor = {
  name: 'external-department-id',
  targetTables: ['external_department_ids'],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    // Enumerate first, read second, and compare. Without this a mistyped label
    // returns zero rows and reconciles as a clean 0 == 0 == 0 — the failure
    // this harness treats as its worst, because it is completely silent.
    const enumerated = await fetchIds(ctx, 'ExternalDepartmentId');

    const rows = await cypher<Row>(
      ctx,
      `MATCH (n:ExternalDepartmentId)
       RETURN n.id AS id, n.departmentId AS departmentId,
              n.name AS name, n.createdAt AS createdAt`,
    );
    recordReadLoss(
      ctx,
      'ExternalDepartmentId',
      enumerated.length - rows.length,
      'enumerated by label but not returned by the property read',
    );

    // A row with no code reserves nothing and cannot be a primary key. None
    // exist in the current snapshot; classified in code anyway so a future
    // import that writes a blank is a logged drop rather than an aborted run.
    const usable: Array<{
      departmentId: string;
      name: string;
      createdAt: Date;
    }> = [];
    const seen = new Set<string>();
    let droppedBlank = 0;
    let droppedDuplicate = 0;
    for (const row of rows) {
      const code = row.departmentId?.trim();
      if (!code) {
        droppedBlank++;
        continue;
      }
      // department_id is the primary key, so a duplicate would be silently
      // swallowed by onConflictDoNothing and show up only as a smaller insert
      // count. The source has none today (565 codes, 565 distinct); counting
      // them here means a future re-import says so out loud.
      if (seen.has(code)) {
        droppedDuplicate++;
        continue;
      }
      seen.add(code);
      usable.push({
        departmentId: code,
        // The Intacct department name. Not unique — one name legitimately
        // covers three codes — so it is carried as data, never as a key.
        name: row.name?.trim() ?? '',
        createdAt: tsReq(row.createdAt as Parameters<typeof tsReq>[0]),
      });
    }
    if (droppedBlank > 0) {
      ctx.log(
        `    ⚠ DROPPED ${droppedBlank} external department id(s) with no code`,
      );
    }
    if (droppedDuplicate > 0) {
      ctx.log(
        `    ⚠ DROPPED ${droppedDuplicate} duplicate external department id(s) — ` +
          `the code is the primary key, so only the first of each is kept`,
      );
    }

    out.external_department_ids = stat(
      rows.length,
      await bulkInsert(ctx, externalDepartmentIds, usable),
    );

    return out;
  },
};
