import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  NotFoundException,
  type UnsecuredDto,
} from '~/common';
import { resolveOrderBy, type SortMap } from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { DrizzleDtoRepository } from '~/core/drizzle/dto.repository';
import { unavailabilities } from '~/core/drizzle/schema';
import {
  type CreateUnavailability,
  Unavailability,
  type UnavailabilityListInput,
  type UpdateUnavailability,
} from './dto';

@Injectable()
export class UnavailabilityDrizzleRepository extends DrizzleDtoRepository<
  typeof unavailabilities,
  Unavailability
> {
  constructor(db: DrizzleService) {
    super(db, unavailabilities, Unavailability);
  }

  async create(
    input: CreateUnavailability,
  ): Promise<UnsecuredDto<Unavailability>> {
    const id = await generateId();
    await this.db.insert(unavailabilities).values({
      id,
      userId: input.user,
      description: input.description,
      start: input.start.toJSDate(),
      end: input.end.toJSDate(),
    });
    return await this.readOne(id);
  }

  async update(
    changes: UpdateUnavailability,
  ): Promise<UnsecuredDto<Unavailability>> {
    const { id, ...fields } = changes;
    await this.updateColumns(id, {
      description: fields.description,
      start: fields.start?.toJSDate(),
      end: fields.end?.toJSDate(),
    });
    return await this.readOne(id);
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  async getUserByUnavailabilityId(id: ID): Promise<{ id: ID<'User'> }> {
    const row = await this.db.query.unavailabilities.findFirst({
      where: (unavailability) => eq(unavailability.id, id),
      columns: { userId: true },
    });
    if (!row) {
      throw new NotFoundException(
        'Could not find user associated with unavailability',
      );
    }
    return { id: row.userId };
  }

  async list(input: UnavailabilityListInput): Promise<{
    items: Array<UnsecuredDto<Unavailability>>;
    total: number;
    hasMore: boolean;
  }> {
    const conditions = [isNull(unavailabilities.deletedAt)];
    if (input.filter?.userId)
      conditions.push(eq(unavailabilities.userId, input.filter.userId));

    const sortColumns = {
      description: unavailabilities.description,
      start: unavailabilities.start,
      end: unavailabilities.end,
    } satisfies SortMap<keyof Unavailability>;

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, unavailabilities.start),
      page: input.page,
      count: input.count,
    });
    return { items: rows.map((row) => this.toDto(row)), total, hasMore };
  }

  protected toDto(
    row: typeof unavailabilities.$inferSelect,
  ): UnsecuredDto<Unavailability> {
    return {
      id: row.id,
      __typename: 'Unavailability',
      createdAt: DateTime.fromJSDate(row.createdAt),
      description: row.description,
      start: DateTime.fromJSDate(row.start),
      end: DateTime.fromJSDate(row.end),
    };
  }
}
