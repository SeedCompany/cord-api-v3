import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  type ID,
  NotFoundException,
  type UnsecuredDto,
} from '~/common';
import { generateId } from '~/common/functions/generate-id';
import { getChanges } from '~/core/database/changes';
import { KyselyService } from '~/core/database/kysely';
import type { FieldRegionSelectedRow } from '~/core/database/kysely/types';
import type { LinkTo } from '~/core/resources';
import {
  type CreateFieldRegion,
  FieldRegion,
  type FieldRegionListInput,
  type UpdateFieldRegion,
} from './dto';
import { FIELD_REGION_SCALAR_FIELDS } from './field-region.fragments';
import {
  fieldRegionKyselyFilters,
  fieldRegionKyselySorters,
} from './field-region.kysely.filters';

// TODO: Replace with real Kysely-compatible auth filter once the auth layer is ported.
// This stub passes all rows through — no auth enforcement.
const noOpFilter = <Q>(qb: Q): Q => qb;

@Injectable()
export class FieldRegionKyselyRepository {
  constructor(private readonly db: KyselyService) {}

  // ------------------------------------------------------------------
  // CREATE
  // ------------------------------------------------------------------

  async create(input: CreateFieldRegion): Promise<UnsecuredDto<FieldRegion>> {
    const existing = await this.db
      .selectFrom('field_regions')
      .where('name', '=', input.name)
      .where('deleted_at', 'is', null)
      .select('id')
      .executeTakeFirst();

    if (existing) {
      throw new DuplicateException(
        'name',
        'FieldRegion with this name already exists.',
      );
    }

    const id = await generateId();

    await this.db
      .insertInto('field_regions')
      .values({
        id,
        name: input.name,
        field_zone_id: input.fieldZone,
        director_id: input.director ?? null,
      })
      .execute();

    return await this.readOne(id);
  }

  // ------------------------------------------------------------------
  // READ ONE
  // ------------------------------------------------------------------

  async readOne(id: ID): Promise<UnsecuredDto<FieldRegion>> {
    const row = await this.db
      .selectFrom('field_regions')
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .$call(noOpFilter) // TODO: replace with real auth filter
      .select(FIELD_REGION_SCALAR_FIELDS)
      .executeTakeFirst();

    if (!row) throw new NotFoundException(`FieldRegion ${id} not found`);
    return this.toDto(row);
  }

  // ------------------------------------------------------------------
  // READ MANY  (DataLoader entry point — preserve input ID order)
  // ------------------------------------------------------------------

  async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<FieldRegion>>> {
    const rows = await this.db
      .selectFrom('field_regions')
      .where('id', 'in', [...ids])
      .where('deleted_at', 'is', null)
      .$call(noOpFilter) // TODO: replace with real auth filter
      .select(FIELD_REGION_SCALAR_FIELDS)
      .execute();

    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => {
      const row = byId.get(id);
      if (!row) throw new NotFoundException(`FieldRegion ${id} not found`);
      return this.toDto(row);
    });
  }

  // ------------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------------

  async update(changes: UpdateFieldRegion): Promise<UnsecuredDto<FieldRegion>> {
    const { id, director, fieldZone, ...rest } = changes;

    const values: Record<string, unknown> = { ...rest };
    if (director !== undefined) values.director_id = director;
    if (fieldZone !== undefined) values.field_zone_id = fieldZone;

    if (Object.keys(values).length > 0) {
      await this.db
        .updateTable('field_regions')
        .set({ ...(values as object), updated_at: new Date() })
        .where('id', '=', id)
        .execute();
    }

    return await this.readOne(id);
  }

  // ------------------------------------------------------------------
  // DELETE (soft)
  // ------------------------------------------------------------------

  async deleteNode(object: { id: ID }): Promise<void> {
    await this.db
      .updateTable('field_regions')
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where('id', '=', object.id)
      .execute();
  }

  // ------------------------------------------------------------------
  // LIST
  // ------------------------------------------------------------------

  async list(input: FieldRegionListInput) {
    const base = this.db
      .selectFrom('field_regions')
      .where('deleted_at', 'is', null)
      .$call(fieldRegionKyselyFilters(input.filter))
      .$call(noOpFilter); // TODO: replace with real auth filter

    const [{ total }, items] = await Promise.all([
      base
        .select((eb) => eb.fn.countAll<string>().as('total'))
        .executeTakeFirstOrThrow(),
      base
        .select(FIELD_REGION_SCALAR_FIELDS)
        .$call(fieldRegionKyselySorters(input))
        .limit(input.count)
        .offset((input.page - 1) * input.count)
        .execute() as unknown as Promise<FieldRegionSelectedRow[]>,
    ]);

    return {
      total: Number(total),
      items: items.map((r) => this.toDto(r)),
      hasMore: (input.page - 1) * input.count + items.length < Number(total),
    };
  }

  // ------------------------------------------------------------------
  // Used by FieldRegionService.update — mirrors DtoRepository.getActualChanges
  // ------------------------------------------------------------------

  readonly getActualChanges = getChanges(FieldRegion);

  // ------------------------------------------------------------------
  // Extra: used by RestrictRegionDirectorRemovalHandler
  // ------------------------------------------------------------------

  async readAllByDirector(
    id: ID<'User'>,
  ): Promise<Array<UnsecuredDto<FieldRegion>>> {
    const rows = await this.db
      .selectFrom('field_regions')
      .where('director_id', '=', id)
      .where('deleted_at', 'is', null)
      .select(FIELD_REGION_SCALAR_FIELDS)
      .execute();

    return rows.map((r) => this.toDto(r));
  }

  // ------------------------------------------------------------------
  // SHAPE MAPPING — raw DB row → UnsecuredDto<FieldRegion>
  // ------------------------------------------------------------------

  private toDto(row: FieldRegionSelectedRow): UnsecuredDto<FieldRegion> {
    const dto: UnsecuredDto<FieldRegion> = {
      id: row.id as ID,
      createdAt: DateTime.fromJSDate(row.created_at),
      name: row.name,
      fieldZone: {
        id: row.field_zone_id as ID<'FieldZone'>,
      } satisfies LinkTo<'FieldZone'>,
      // director_id is nullable in the DB; UnsecuredDto<FieldRegion> is overly strict here
      director: (row.director_id
        ? ({ id: row.director_id as ID<'User'> } satisfies LinkTo<'User'>)
        : undefined) as LinkTo<'User'>,
    };
    return dto;
  }
}
