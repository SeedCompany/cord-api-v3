import { asc, desc, type SQL } from 'drizzle-orm';
import { type PgColumn } from 'drizzle-orm/pg-core';
import { type Order } from '~/common';

export function orderByColumn(col: PgColumn, order: Order = 'ASC'): SQL {
  return order === 'ASC' ? asc(col) : desc(col);
}
