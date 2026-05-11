import { Injectable } from '@nestjs/common';
import { and, eq, ilike, isNull, type SQL } from 'drizzle-orm';
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
  escapeLikePattern,
  resolveOrderBy,
  type SortMap,
  subFilter,
} from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { fieldRegions, fieldZones, users } from '~/core/drizzle/schema';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { fieldZoneFilterClauses } from '../field-zone/field-zone.drizzle.repository';
import { userFilterClauses } from '../user/user.drizzle.repository';
import {
  type CreateFieldRegion,
  FieldRegion,
  type FieldRegionListInput,
  type UpdateFieldRegion,
} from './dto';

const catchNameUnique = catchUniqueViolation(
  'name',
  'name',
  'FieldRegion with this name already exists.',
);

@Injectable()
export class FieldRegionDrizzleRepository extends DrizzleDtoRepository<
  typeof fieldRegions,
  FieldRegion
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
  ) {
    super(db, fieldRegions, FieldRegion);
  }

  async create(input: CreateFieldRegion): Promise<UnsecuredDto<FieldRegion>> {
    const id = await generateId();
    await this.db
      .insert(fieldRegions)
      .values({
        id,
        name: input.name,
        fieldZoneId: input.fieldZone,
        directorId: input.director,
      })
      .catch(catchNameUnique);
    return await this.readOne(id);
  }

  async update(changes: UpdateFieldRegion): Promise<UnsecuredDto<FieldRegion>> {
    const { id, fieldZone, director, ...fields } = changes;
    await this.updateColumns(id, {
      name: fields.name,
      fieldZoneId: fieldZone,
      directorId: director,
    }).catch(catchNameUnique);
    return await this.readOne(id);
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  async list(
    input: FieldRegionListInput,
  ): Promise<PaginatedListType<UnsecuredDto<FieldRegion>>> {
    const conditions: SQL[] = [isNull(fieldRegions.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }

    if (input.filter?.name) {
      conditions.push(
        ilike(fieldRegions.name, `%${escapeLikePattern(input.filter.name)}%`),
      );
    }
    if (input.filter?.director) {
      conditions.push(
        subFilter(
          this.db,
          fieldRegions.directorId,
          users,
          userFilterClauses(this.db, input.filter.director),
        ),
      );
    }
    if (input.filter?.fieldZone) {
      conditions.push(
        subFilter(
          this.db,
          fieldRegions.fieldZoneId,
          fieldZones,
          fieldZoneFilterClauses(this.db, input.filter.fieldZone),
        ),
      );
    }

    const sortColumns = {
      name: fieldRegions.name,
      createdAt: fieldRegions.createdAt,
    } satisfies SortMap<keyof FieldRegion>;

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, fieldRegions.name),
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
  ): Promise<ReadonlyArray<UnsecuredDto<FieldRegion>>> {
    const rows = await this.db
      .select()
      .from(fieldRegions)
      .where(
        and(eq(fieldRegions.directorId, id), isNull(fieldRegions.deletedAt)),
      );
    return rows.map((row) => this.toDto(row));
  }

  protected toDto(
    row: typeof fieldRegions.$inferSelect,
  ): UnsecuredDto<FieldRegion> {
    return {
      id: row.id,
      __typename: 'FieldRegion',
      createdAt: DateTime.fromJSDate(row.createdAt),
      name: row.name,
      fieldZone: { id: row.fieldZoneId },
      director: { id: row.directorId },
    };
  }
}
