import { and, asc, count, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { type AnyPgColumn, type PgTable } from 'drizzle-orm/pg-core';
import { type ID, NotFoundException, type UnsecuredDto } from '~/common';
import { type DrizzleService } from './drizzle.service';

/**
 * Common machinery for CRUD repositories on a single Drizzle table.
 *
 * Subclasses provide the table reference and a `toDto()` mapper. Tables with
 * a `deletedAt` column get soft-delete filtering on reads and a `softDelete()`
 * helper for free; tables with `updatedAt` get an automatic timestamp bump on
 * `updateColumns()`.
 *
 * Repos that need related rows (e.g. `with: { globalRoles: true }`) override
 * `readMany` and call `toDto` themselves — the base only handles flat tables.
 */
export abstract class DrizzleDtoRepository<
  TTable extends PgTable & { id: AnyPgColumn },
  TDto extends { id: ID },
> {
  constructor(
    protected readonly db: DrizzleService,
    protected readonly table: TTable,
  ) {}

  protected abstract toDto(row: TTable['$inferSelect']): UnsecuredDto<TDto>;

  async readOne(id: ID): Promise<UnsecuredDto<TDto>> {
    const rows = await this.readMany([id]);
    const row = rows.find((r) => r.id === id);
    if (!row) throw new NotFoundException();
    return row;
  }

  async readMany(ids: readonly ID[]): Promise<Array<UnsecuredDto<TDto>>> {
    if (ids.length === 0) return [];
    const conds: SQL[] = [inArray(this.table.id, [...ids])];
    const deletedAt = (this.table as Record<string, unknown>).deletedAt as
      | AnyPgColumn
      | undefined;
    if (deletedAt) conds.push(isNull(deletedAt));
    const rows = (await this.db.db
      .select()
      .from(this.table as PgTable)
      .where(and(...conds))) as Array<TTable['$inferSelect']>;
    return rows.map((r) => this.toDto(r));
  }

  protected async softDelete(id: ID): Promise<void> {
    const set: Record<string, unknown> = { deletedAt: new Date() };
    await this.db.db
      .update(this.table as PgTable)
      .set(set as never)
      .where(eq(this.table.id, id));
  }

  /**
   * Apply a partial change set to the row. Drops `undefined` values and
   * stamps `updatedAt` when that column exists. No-op if no fields remain
   * after filtering.
   */
  protected async updateColumns(
    id: ID,
    changes: Partial<TTable['$inferInsert']>,
  ): Promise<void> {
    const entries = Object.entries(changes).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return;
    const set: Record<string, unknown> = Object.fromEntries(entries);
    if ((this.table as Record<string, unknown>).updatedAt) {
      set.updatedAt = new Date();
    }
    await this.db.db
      .update(this.table as PgTable)
      .set(set as never)
      .where(eq(this.table.id, id));
  }

  /**
   * Run a paginated SELECT against the repository's table. Always appends
   * `asc(table.id)` as the final ORDER BY so identical primary-sort values
   * don't shuffle across pages.
   *
   * Caller is responsible for the predicate (including any `isNull(deletedAt)`
   * filter) and the primary ORDER BY columns. Returns rows untransformed —
   * caller maps to DTOs and adds any per-page side-loaded data.
   */
  protected async paginatedSelect(args: {
    predicate?: SQL;
    orderBy?: SQL[];
    page: number;
    count: number;
  }): Promise<{
    rows: Array<TTable['$inferSelect']>;
    total: number;
    hasMore: boolean;
  }> {
    const { predicate, orderBy = [], page, count: pageSize } = args;
    const offset = (page - 1) * pageSize;
    const [countResult, rows] = await Promise.all([
      this.db.db
        .select({ total: count() })
        .from(this.table as PgTable)
        .where(predicate),
      this.db.db
        .select()
        .from(this.table as PgTable)
        .where(predicate)
        .orderBy(...orderBy, asc(this.table.id))
        .limit(pageSize)
        .offset(offset),
    ]);
    const total = countResult[0]?.total ?? 0;
    return {
      rows: rows as Array<TTable['$inferSelect']>,
      total,
      hasMore: offset + rows.length < total,
    };
  }
}
