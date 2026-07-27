import { and, eq, inArray, type SQL, sql } from 'drizzle-orm';
import { type AnyPgColumn } from 'drizzle-orm/pg-core';
import { type ID } from '~/common';
import { type DrizzleDb } from '~/core/drizzle/drizzle.service';
import { pins } from '~/core/drizzle/schema';

/**
 * Which of `resourceIds` the user has pinned. Batch lookup for hydrating the
 * per-requester `pinned` field on a page of Pinnable rows — same shape as
 * `requesterScopeByProject`. Returns an empty set for anonymous requesters
 * (no userId).
 */
export const pinnedByRequester = async (
  db: DrizzleDb,
  userId: ID<'User'> | undefined,
  resourceIds: readonly ID[],
): Promise<Set<ID>> => {
  if (!userId || resourceIds.length === 0) return new Set();
  const rows = await db
    .select({ resourceId: pins.resourceId })
    .from(pins)
    .where(
      and(eq(pins.userId, userId), inArray(pins.resourceId, [...resourceIds])),
    );
  return new Set(rows.map((r) => r.resourceId));
};

/**
 * `EXISTS`/`NOT EXISTS` predicate for a list filter's `pinned` boolean,
 * correlated against the domain table's id column. Anonymous requesters
 * never have pins, so `pinned: true` matches nothing and `pinned: false`
 * matches everything.
 */
export const pinnedFilter = (
  userId: ID<'User'> | undefined,
  idColumn: AnyPgColumn,
  wantPinned: boolean,
): SQL => {
  if (!userId) {
    return wantPinned ? sql`false` : sql`true`;
  }
  const exists = sql`exists (
    select 1 from "pins"
    where "pins"."user_id" = ${userId}
      and "pins"."resource_id" = ${idColumn}
  )`;
  return wantPinned ? exists : sql`not ${exists}`;
};
