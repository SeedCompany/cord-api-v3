import { Inject } from '@nestjs/common';
import { and, asc, count, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { type AnyPgColumn, type PgTable } from 'drizzle-orm/pg-core';
import {
  EnhancedResource,
  type ID,
  NotFoundException,
  type ResourceShape,
  type UnsecuredDto,
} from '~/common';
import { LiveQueryStore } from '~/core/live-query';
import { getChanges } from '../database/changes';
import { type DrizzleService } from './drizzle.service';

/**
 * The shape `list()` returns when policy denies read access — caller bails
 * out before touching the DB. Use with `PolicyExecutor.applyReadFilter()`.
 */
export const EMPTY_PAGE = {
  items: [] as never[],
  total: 0,
  hasMore: false,
} as const;

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
 *
 * ## Live-query invalidation
 *
 * `updateColumns()` and `softDelete()` invalidate the mutated resource, matching
 * what the Neo4j and Gel bases do generically. Without it, the ~12 cord-field
 * documents carrying `@live` — the detail page of nearly every domain — stay
 * stale after an edit until the user refreshes manually.
 *
 * The call is safe to make inside the mutation transaction: `LiveQueryStoreImpl`
 * defers the actual work to `TransactionHooks.afterCommit`, which the Drizzle
 * mutation interceptor runs (it inherits `runAndClear()` from
 * `TransactionalMutationsInterceptor`). So a rolled-back mutation never
 * invalidates, and re-execution never reads pre-commit state.
 *
 * NOT covered, deliberately:
 * - **`create`** — a brand-new id has nothing watching it yet. Neither other
 *   engine invalidates on create either, so this is parity. List-level queries
 *   (`Query.users`) do go stale on create on ALL THREE engines; that's a
 *   pre-existing gap, not one this base introduces.
 * - **Subclass-owned writes** — a repo that hand-rolls its own `update`/`delete`
 *   instead of going through these two helpers still has to invalidate itself,
 *   exactly as on the other engines.
 */
export abstract class DrizzleDtoRepository<
  TTable extends PgTable & {
    id: AnyPgColumn;
    deletedAt?: AnyPgColumn;
    updatedAt?: AnyPgColumn;
  },
  TDto extends { id: ID },
> {
  protected readonly resource: EnhancedResource<ResourceShape<TDto>>;

  /**
   * Property-injected, not a constructor param, so no subclass has to thread it
   * through `super()` — same pattern as the Neo4j and Gel bases, which inject it
   * the same way.
   */
  @Inject() protected readonly liveQueryStore: LiveQueryStore;

  /**
   * Diff an existing DTO against an `Update*` input and return only fields
   * whose values actually changed. Mirrors the helper on the Neo4j and Gel
   * bases — services call `repo.getActualChanges(existing, input)` regardless
   * of which engine `splitDb` resolves to.
   */
  readonly getActualChanges!: ReturnType<
    typeof getChanges<ResourceShape<TDto>>
  >;

  constructor(
    private readonly drizzle: DrizzleService,
    protected readonly table: TTable,
    dto: ResourceShape<TDto>,
  ) {
    this.resource = EnhancedResource.of(dto);
    this.getActualChanges = getChanges(dto);
  }

  /**
   * Drizzle client. A getter (not a captured value) so AsyncLocalStorage-bound
   * transactions in `DrizzleService.client` flow through on every access — if
   * we cached `drizzle.client` at construction time, we'd freeze it to the
   * base instance and silently bypass transactions opened via `inTx()`.
   */
  protected get db() {
    return this.drizzle.client;
  }

  protected abstract toDto(row: TTable['$inferSelect']): UnsecuredDto<TDto>;

  async readOne(id: ID): Promise<UnsecuredDto<TDto>> {
    const rows = await this.readMany([id]);
    const row = rows.find((row) => row.id === id);
    if (!row) throw new NotFoundException();
    return row;
  }

  async readMany(ids: readonly ID[]): Promise<Array<UnsecuredDto<TDto>>> {
    if (ids.length === 0) return [];
    const conditions: SQL[] = [inArray(this.table.id, [...ids])];
    if (this.table.deletedAt) {
      conditions.push(isNull(this.table.deletedAt));
    }
    const rows = await this.db
      .select()
      .from(this.table as PgTable)
      .where(and(...conditions));
    return rows.map((row) => this.toDto(row));
  }

  /**
   * Pre-flight check that no active row has the given value in `columnName`.
   * Mirrors `DtoRepository.isUnique()` from the Neo4j base so services can
   * call `this.repo.isUnique(name)` without caring about the engine.
   *
   * Excludes soft-deleted rows to match Neo4j behavior (soft-deleted labels
   * are prefixed with `Deleted_`, so they don't collide on the lookup). If a
   * soft-deleted row still owns the name at the DB level, the unique-violation
   * catch in `create()` converts the conflict to a `DuplicateException`.
   */
  async isUnique(value: string, columnName = 'name'): Promise<boolean> {
    const column = (this.table as Record<string, unknown>)[columnName] as
      | AnyPgColumn
      | undefined;
    if (!column) {
      throw new Error(`isUnique: column "${columnName}" not found on table`);
    }
    const conditions: SQL[] = [eq(column, value)];
    if (this.table.deletedAt) {
      conditions.push(isNull(this.table.deletedAt));
    }
    const rows = await this.db
      .select({ id: this.table.id })
      .from(this.table as PgTable)
      .where(and(...conditions))
      .limit(1);
    return rows.length === 0;
  }

  /**
   * Sets `deletedAt = now()` on the row. Subclass is responsible for ensuring
   * the table actually has a `deletedAt` column (the generic constraint allows
   * but doesn't require it).
   */
  protected async softDelete(id: ID): Promise<void> {
    this.liveQueryStore.invalidate([this.resource, id]);
    await this.db
      .update(this.table as PgTable)
      .set({ deletedAt: new Date() })
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
    // After the no-op guard: nothing changed means nothing to invalidate.
    this.liveQueryStore.invalidate([this.resource, id]);
    const set = Object.fromEntries(entries);
    if (this.table.updatedAt) {
      set.updatedAt = new Date();
    }
    await this.db
      .update(this.table as PgTable)
      .set(set)
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
      this.db
        .select({ total: count() })
        .from(this.table as PgTable)
        .where(predicate),
      this.db
        .select()
        .from(this.table as PgTable)
        .where(predicate)
        .orderBy(...orderBy, asc(this.table.id))
        .limit(pageSize)
        .offset(offset),
    ]);
    const total = countResult[0]?.total ?? 0;
    return {
      rows,
      total,
      hasMore: offset + rows.length < total,
    };
  }
}
