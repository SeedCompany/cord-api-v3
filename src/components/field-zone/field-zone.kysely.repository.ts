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
import type { FieldZoneSelectedRow } from '~/core/database/kysely/types';
import type { LinkTo } from '~/core/resources';
import {
  type CreateFieldZone,
  FieldZone,
  type FieldZoneListInput,
  type UpdateFieldZone,
} from './dto';
import { FIELD_ZONE_SCALAR_FIELDS } from './field-zone.fragments';
import {
  fieldZoneKyselyFilters,
  fieldZoneKyselySorters,
} from './field-zone.kysely.filters';

// TODO: Replace with real Kysely-compatible auth filter once the auth layer is ported.
const noOpFilter = <Q>(qb: Q): Q => qb;

@Injectable()
export class FieldZoneKyselyRepository {
  constructor(private readonly db: KyselyService) {}

  // ------------------------------------------------------------------
  // CREATE
  // ------------------------------------------------------------------

  async create(input: CreateFieldZone): Promise<UnsecuredDto<FieldZone>> {
    const existing = await this.db
      .selectFrom('field_zones')
      .where('name', '=', input.name)
      .where('deleted_at', 'is', null)
      .select('id')
      .executeTakeFirst();

    if (existing) {
      throw new DuplicateException(
        'name',
        'FieldZone with this name already exists.',
      );
    }

    const id = await generateId();

    await this.db
      .insertInto('field_zones')
      .values({
        id,
        name: input.name,
        director_id: input.director ?? null,
      })
      .execute();

    return await this.readOne(id);
  }

  // ------------------------------------------------------------------
  // READ ONE
  // ------------------------------------------------------------------

  async readOne(id: ID): Promise<UnsecuredDto<FieldZone>> {
    const row = await this.db
      .selectFrom('field_zones')
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .$call(noOpFilter)
      .select(FIELD_ZONE_SCALAR_FIELDS)
      .executeTakeFirst();

    if (!row) throw new NotFoundException(`FieldZone ${id} not found`);
    return this.toDto(row);
  }

  // ------------------------------------------------------------------
  // READ MANY  (DataLoader entry point — preserve input ID order)
  // ------------------------------------------------------------------

  async readMany(ids: readonly ID[]): Promise<Array<UnsecuredDto<FieldZone>>> {
    const rows = await this.db
      .selectFrom('field_zones')
      .where('id', 'in', [...ids])
      .where('deleted_at', 'is', null)
      .$call(noOpFilter)
      .select(FIELD_ZONE_SCALAR_FIELDS)
      .execute();

    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => {
      const row = byId.get(id);
      if (!row) throw new NotFoundException(`FieldZone ${id} not found`);
      return this.toDto(row);
    });
  }

  // ------------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------------

  async update(changes: UpdateFieldZone): Promise<UnsecuredDto<FieldZone>> {
    const { id, director, ...rest } = changes;

    const values: Record<string, unknown> = { ...rest };
    if (director !== undefined) values.director_id = director;

    if (Object.keys(values).length > 0) {
      await this.db
        .updateTable('field_zones')
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
      .updateTable('field_zones')
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where('id', '=', object.id)
      .execute();
  }

  // ------------------------------------------------------------------
  // LIST
  // ------------------------------------------------------------------

  async list(input: FieldZoneListInput) {
    const base = this.db
      .selectFrom('field_zones')
      .where('deleted_at', 'is', null)
      .$call(fieldZoneKyselyFilters(input.filter))
      .$call(noOpFilter);

    const [{ total }, items] = await Promise.all([
      base
        .select((eb) => eb.fn.countAll<string>().as('total'))
        .executeTakeFirstOrThrow(),
      base
        .select(FIELD_ZONE_SCALAR_FIELDS)
        .$call(fieldZoneKyselySorters(input))
        .limit(input.count)
        .offset((input.page - 1) * input.count)
        .execute() as unknown as Promise<FieldZoneSelectedRow[]>,
    ]);

    return {
      total: Number(total),
      items: items.map((r) => this.toDto(r)),
      hasMore: (input.page - 1) * input.count + items.length < Number(total),
    };
  }

  // ------------------------------------------------------------------
  // Extra: used by RestrictZoneDirectorRemovalHandler
  // ------------------------------------------------------------------

  async readAllByDirector(
    id: ID<'User'>,
  ): Promise<Array<UnsecuredDto<FieldZone>>> {
    const rows = await this.db
      .selectFrom('field_zones')
      .where('director_id', '=', id)
      .where('deleted_at', 'is', null)
      .select(FIELD_ZONE_SCALAR_FIELDS)
      .execute();

    return rows.map((r) => this.toDto(r));
  }

  // ------------------------------------------------------------------
  // Used by FieldZoneService.update — mirrors DtoRepository.getActualChanges
  // ------------------------------------------------------------------

  readonly getActualChanges = getChanges(FieldZone);

  // ------------------------------------------------------------------
  // SHAPE MAPPING — raw DB row → UnsecuredDto<FieldZone>
  // ------------------------------------------------------------------

  private toDto(row: FieldZoneSelectedRow): UnsecuredDto<FieldZone> {
    const dto: UnsecuredDto<FieldZone> = {
      id: row.id as ID,
      createdAt: DateTime.fromJSDate(row.created_at),
      name: row.name,
      // director_id is nullable in the DB; UnsecuredDto<FieldZone> is overly strict here
      director: (row.director_id
        ? ({ id: row.director_id as ID<'User'> } satisfies LinkTo<'User'>)
        : undefined) as LinkTo<'User'>,
    };
    return dto;
  }
}
