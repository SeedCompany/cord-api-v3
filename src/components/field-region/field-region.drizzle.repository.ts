import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CreationFailed,
  DuplicateException,
  type ID,
  NotFoundException,
  ReadAfterCreationFailed,
  type UnsecuredDto,
} from '~/common';
import { generateId } from '~/common/functions/generate-id';
import { getChanges } from '~/core/database/changes';
import { DrizzleService } from '~/core/database/drizzle/drizzle.service';
import { fieldRegions } from '~/core/database/drizzle/schema';
import { type LinkTo } from '~/core/resources';
import {
  type CreateFieldRegion,
  FieldRegion,
  type FieldRegionListInput,
  type UpdateFieldRegion,
} from './dto';

type FieldRegionRow = typeof fieldRegions.$inferSelect;

@Injectable()
export class FieldRegionDrizzleRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  readonly getActualChanges = getChanges(FieldRegion);

  async readOne(id: ID): Promise<UnsecuredDto<FieldRegion>> {
    const row = await this.drizzle.db.query.fieldRegions.findFirst({
      where: (t, { eq: e }) => e(t.id, id),
    });
    if (!row) throw new NotFoundException('Could not find field region');
    return this.toDto(row);
  }

  async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<FieldRegion>>> {
    const rows = await this.drizzle.db.query.fieldRegions.findMany({
      where: (t, { inArray }) => inArray(t.id, [...ids]),
    });
    return rows.map((r) => this.toDto(r));
  }

  async readAllByDirector(
    directorId: ID<'User'>,
  ): Promise<Array<UnsecuredDto<FieldRegion>>> {
    const rows = await this.drizzle.db.query.fieldRegions.findMany({
      where: (t, { eq: e }) => e(t.director_id, directorId),
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(input: CreateFieldRegion): Promise<UnsecuredDto<FieldRegion>> {
    const existing = await this.drizzle.db.query.fieldRegions.findFirst({
      where: (t, { eq: e }) => e(t.name, input.name),
    });
    if (existing) {
      throw new DuplicateException(
        'name',
        'FieldRegion with this name already exists.',
      );
    }

    const id = await generateId();
    const [row] = await this.drizzle.db
      .insert(fieldRegions)
      .values({
        id,
        name: input.name,
        director_id: input.director ?? null,
        field_zone_id: input.fieldZone,
      })
      .returning();

    if (!row) throw new CreationFailed(FieldRegion);

    return await this.readOne(id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(FieldRegion)
        : e;
    });
  }

  async update(input: UpdateFieldRegion): Promise<UnsecuredDto<FieldRegion>> {
    const updates: Partial<typeof fieldRegions.$inferInsert> = {
      updated_at: new Date(),
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.director !== undefined)
      updates.director_id = input.director ?? null;
    if (input.fieldZone !== undefined) updates.field_zone_id = input.fieldZone;

    await this.drizzle.db
      .update(fieldRegions)
      .set(updates)
      .where(eq(fieldRegions.id, input.id));

    return await this.readOne(input.id);
  }

  async deleteNode(objectOrId: { id: ID } | ID) {
    const id = typeof objectOrId === 'string' ? objectOrId : objectOrId.id;
    await this.drizzle.db.delete(fieldRegions).where(eq(fieldRegions.id, id));
    return { at: DateTime.now() };
  }

  async list(input: FieldRegionListInput) {
    const { count, page, sort, order, filter } = input;
    const offset = (page - 1) * count;
    const orderBy =
      sort === 'name'
        ? order === 'ASC'
          ? asc(fieldRegions.name)
          : desc(fieldRegions.name)
        : order === 'ASC'
          ? asc(fieldRegions.created_at)
          : desc(fieldRegions.created_at);

    const conditions = [
      filter?.id ? eq(fieldRegions.id, filter.id) : undefined,
      filter?.fieldZone
        ? eq(fieldRegions.field_zone_id, filter.fieldZone.id!)
        : undefined,
    ].filter(Boolean);
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      this.drizzle.db
        .select()
        .from(fieldRegions)
        .where(where)
        .orderBy(orderBy)
        .limit(count)
        .offset(offset),
      this.drizzle.db
        .select({ total: sql<number>`count(*)::int` })
        .from(fieldRegions)
        .where(where),
    ]);

    const total = countRows[0]?.total ?? 0;
    return {
      items: rows.map((r) => this.toDto(r)),
      total,
      hasMore: offset + rows.length < total,
    };
  }

  private toDto(row: FieldRegionRow): UnsecuredDto<FieldRegion> {
    return {
      id: row.id as ID,
      createdAt: DateTime.fromJSDate(row.created_at),
      name: row.name,
      fieldZone: {
        id: row.field_zone_id as ID<'FieldZone'>,
      } satisfies LinkTo<'FieldZone'>,
      director: (row.director_id
        ? { id: row.director_id as ID<'User'> }
        : undefined) as LinkTo<'User'>,
    };
  }
}
