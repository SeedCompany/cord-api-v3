import { Injectable } from '@nestjs/common';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  type PaginatedListType,
  type UnsecuredDto,
} from '~/common';
import {
  catchUniqueViolation,
  DrizzleDtoRepository,
  EMPTY_PAGE,
  resolveOrderBy,
  type SortMap,
  subFilter,
} from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import { fieldZones, users } from '~/core/drizzle/schema';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { userFilterClauses } from '../user/user.drizzle.repository';
import {
  type CreateFieldZone,
  FieldZone,
  type FieldZoneFilters,
  type FieldZoneListInput,
  type UpdateFieldZone,
} from './dto';

const catchNameUnique = catchUniqueViolation(
  'name',
  'name',
  'FieldZone with this name already exists.',
);

@Injectable()
export class FieldZoneDrizzleRepository extends DrizzleDtoRepository<
  typeof fieldZones,
  FieldZone
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
  ) {
    super(db, fieldZones, FieldZone);
  }

  async create(input: CreateFieldZone): Promise<UnsecuredDto<FieldZone>> {
    const id = await generateId();
    await this.db
      .insert(fieldZones)
      .values({
        id,
        name: input.name,
        directorId: input.director,
      })
      .catch(catchNameUnique);
    return await this.readOne(id);
  }

  async update(changes: UpdateFieldZone): Promise<UnsecuredDto<FieldZone>> {
    const { id, director, ...fields } = changes;
    await this.updateColumns(id, {
      name: fields.name,
      directorId: director,
    }).catch(catchNameUnique);
    return await this.readOne(id);
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  async list(
    input: FieldZoneListInput,
  ): Promise<PaginatedListType<UnsecuredDto<FieldZone>>> {
    const conditions: SQL[] = [
      isNull(fieldZones.deletedAt),
      ...fieldZoneFilterClauses(this.db, input.filter),
    ];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }

    const sortColumns = {
      name: fieldZones.name,
      createdAt: fieldZones.createdAt,
    } satisfies SortMap<keyof FieldZone>;

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, fieldZones.name),
      page: input.page,
      count: input.count,
    });
    return {
      total,
      items: rows.map((row) => this.toDto(row)),
      hasMore,
    };
  }

  async readAllByDirector(
    id: ID<'User'>,
  ): Promise<ReadonlyArray<UnsecuredDto<FieldZone>>> {
    const rows = await this.db
      .select()
      .from(fieldZones)
      .where(and(eq(fieldZones.directorId, id), isNull(fieldZones.deletedAt)));
    return rows.map((row) => this.toDto(row));
  }

  protected toDto(
    row: typeof fieldZones.$inferSelect,
  ): UnsecuredDto<FieldZone> {
    return {
      id: row.id,
      __typename: 'FieldZone',
      createdAt: DateTime.fromJSDate(row.createdAt),
      name: row.name,
      director: { id: row.directorId },
    };
  }
}

/**
 * Build the column-level WHERE clauses for a `FieldZoneFilters` input against
 * the `field_zones` table. Reusable from sub-filters in other domains
 * (e.g. FieldRegion's `fieldZone` filter).
 */
export const fieldZoneFilterClauses = (
  db: DrizzleDb,
  filter: FieldZoneFilters | undefined,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;
  if (filter.id) conditions.push(eq(fieldZones.id, filter.id));
  if (filter.director) {
    conditions.push(
      subFilter(
        db,
        fieldZones.directorId,
        users,
        userFilterClauses(db, filter.director),
      ),
    );
  }
  return conditions;
};
