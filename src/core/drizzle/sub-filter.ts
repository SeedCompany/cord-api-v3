import { and, inArray, isNull, type SQL } from 'drizzle-orm';
import { type AnyPgColumn, type PgTable } from 'drizzle-orm/pg-core';
import { type DrizzleDb } from './drizzle.service';

/**
 * Build a sub-filter that restricts an outer query to rows whose FK column
 * references a row in `subTable` matching the given clauses. Pairs with the
 * `*FilterClauses(...)` helpers each repo exports.
 *
 * Soft-deleted rows in the sub-table are automatically excluded when the
 * sub-table has a `deletedAt` column.
 *
 * @example
 *   if (input.filter?.director) {
 *     conditions.push(subFilter(
 *       this.db,
 *       fieldRegions.directorId,
 *       users,
 *       userFilterClauses(this.db, input.filter.director),
 *     ));
 *   }
 */
export const subFilter = (
  db: DrizzleDb,
  linkedColumn: AnyPgColumn,
  subTable: PgTable & { id: AnyPgColumn; deletedAt?: AnyPgColumn },
  clauses: SQL[],
): SQL => {
  const conditions: SQL[] = subTable.deletedAt
    ? [isNull(subTable.deletedAt), ...clauses]
    : [...clauses];
  const subq = db
    .select({ id: subTable.id })
    .from(subTable)
    .where(and(...conditions));
  return inArray(linkedColumn, subq);
};
