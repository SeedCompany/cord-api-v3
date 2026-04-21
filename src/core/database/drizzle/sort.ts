import { asc, desc, type SQL } from 'drizzle-orm';
import { type PgColumn } from 'drizzle-orm/pg-core';

export type SortOrder = 'ASC' | 'DESC';

export function orderByColumn(col: PgColumn, order: SortOrder = 'ASC'): SQL {
  return order === 'ASC' ? asc(col) : desc(col);
}
