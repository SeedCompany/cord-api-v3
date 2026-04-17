import { Injectable } from '@nestjs/common';
import { asc, desc, eq, sql } from 'drizzle-orm';
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
import { fieldZones } from '~/core/database/drizzle/schema';
import { type LinkTo } from '~/core/resources';
import {
  type CreateFieldZone,
  FieldZone,
  type FieldZoneListInput,
  type UpdateFieldZone,
} from './dto';

type FieldZoneRow = typeof fieldZones.$inferSelect;

@Injectable()
export class FieldZoneDrizzleRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  readonly getActualChanges = getChanges(FieldZone);

  async readOne(id: ID): Promise<UnsecuredDto<FieldZone>> {
    const row = await this.drizzle.db.query.fieldZones.findFirst({
      where: (t, { eq: e }) => e(t.id, id),
    });
    if (!row) throw new NotFoundException('Could not find field zone');
    return this.toDto(row);
  }

  async readMany(ids: readonly ID[]): Promise<Array<UnsecuredDto<FieldZone>>> {
    const rows = await this.drizzle.db.query.fieldZones.findMany({
      where: (t, { inArray }) => inArray(t.id, [...ids]),
    });
    return rows.map((r) => this.toDto(r));
  }

  async readAllByDirector(
    directorId: ID<'User'>,
  ): Promise<Array<UnsecuredDto<FieldZone>>> {
    const rows = await this.drizzle.db.query.fieldZones.findMany({
      where: (t, { eq: e }) => e(t.director_id, directorId),
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(input: CreateFieldZone): Promise<UnsecuredDto<FieldZone>> {
    const existing = await this.drizzle.db.query.fieldZones.findFirst({
      where: (t, { eq: e }) => e(t.name, input.name),
    });
    if (existing) {
      throw new DuplicateException(
        'name',
        'FieldZone with this name already exists.',
      );
    }

    const id = await generateId();
    const [row] = await this.drizzle.db
      .insert(fieldZones)
      .values({ id, name: input.name, director_id: input.director ?? null })
      .returning();

    if (!row) throw new CreationFailed(FieldZone);

    return await this.readOne(id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(FieldZone)
        : e;
    });
  }

  async update(input: UpdateFieldZone): Promise<UnsecuredDto<FieldZone>> {
    const updates: Partial<typeof fieldZones.$inferInsert> = {
      updated_at: new Date(),
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.director !== undefined)
      updates.director_id = input.director ?? null;

    await this.drizzle.db
      .update(fieldZones)
      .set(updates)
      .where(eq(fieldZones.id, input.id));

    return await this.readOne(input.id);
  }

  async deleteNode(objectOrId: { id: ID } | ID) {
    const id = typeof objectOrId === 'string' ? objectOrId : objectOrId.id;
    await this.drizzle.db.delete(fieldZones).where(eq(fieldZones.id, id));
    return { at: DateTime.now() };
  }

  async list(input: FieldZoneListInput) {
    const { count, page, sort, order, filter } = input;
    const offset = (page - 1) * count;
    const orderBy =
      sort === 'name'
        ? order === 'ASC'
          ? asc(fieldZones.name)
          : desc(fieldZones.name)
        : order === 'ASC'
          ? asc(fieldZones.created_at)
          : desc(fieldZones.created_at);

    const where = filter?.id ? eq(fieldZones.id, filter.id) : undefined;

    const [rows, countRows] = await Promise.all([
      this.drizzle.db
        .select()
        .from(fieldZones)
        .where(where)
        .orderBy(orderBy)
        .limit(count)
        .offset(offset),
      this.drizzle.db
        .select({ total: sql<number>`count(*)::int` })
        .from(fieldZones)
        .where(where),
    ]);

    const total = countRows[0]?.total ?? 0;
    return {
      items: rows.map((r) => this.toDto(r)),
      total,
      hasMore: offset + rows.length < total,
    };
  }

  private toDto(row: FieldZoneRow): UnsecuredDto<FieldZone> {
    return {
      id: row.id as ID,
      createdAt: DateTime.fromJSDate(row.created_at),
      name: row.name,
      director: (row.director_id
        ? { id: row.director_id as ID<'User'> }
        : undefined) as LinkTo<'User'>,
    };
  }
}
