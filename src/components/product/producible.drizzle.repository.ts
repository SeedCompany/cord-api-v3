import { sortBy } from '@seedcompany/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  type Order,
  type PaginatedListType,
  type Range,
  type ResourceShape,
  type SecuredString,
  type UnsecuredDto,
} from '~/common';
import {
  DrizzleDtoRepository,
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import { type DrizzleService } from '~/core/drizzle/drizzle.service';
import { catchUniqueViolation } from '~/core/drizzle/errors';
import { producibles } from '~/core/drizzle/schema';
import { ScriptureRange, type ScriptureRangeInput } from '../scripture/dto';
import { type Producible } from './dto';

type ProducibleTypeName = (typeof producibles.type.enumValues)[number];

type ProducibleDto = Producible & { name: SecuredString };

const parseRefs = (refs: ReadonlyArray<Range<number>>) =>
  sortBy(refs, [(r) => r.start, (r) => r.end]).map(ScriptureRange.fromIds);

/**
 * Shared CRUD for the shape-identical producibles (Film / Story / EthnoArt) —
 * one table, the `type` column standing in for the Neo4j label. Each concrete
 * repo pins its discriminator and inherits everything.
 */
export abstract class ProducibleDrizzleRepository<
  TDto extends ProducibleDto,
> extends DrizzleDtoRepository<typeof producibles, TDto> {
  protected constructor(
    db: DrizzleService,
    dto: ResourceShape<TDto>,
    protected readonly type: ProducibleTypeName,
  ) {
    super(db, producibles, dto);
  }

  async create(input: {
    name: string;
    scriptureReferences?: readonly ScriptureRangeInput[];
  }): Promise<UnsecuredDto<TDto>> {
    const id = await generateId();
    await this.db
      .insert(producibles)
      .values({
        id,
        type: this.type,
        name: input.name,
        scriptureReferences: (input.scriptureReferences ?? []).map(
          ScriptureRange.fromReferences,
        ),
      })
      .catch(
        catchUniqueViolation(
          'producibles_type_name_active_unique',
          'name',
          `${this.type} with this name already exists`,
        ),
      );
    return await this.readOne(id);
  }

  async update(changes: {
    id: ID;
    name?: string;
    scriptureReferences?: readonly ScriptureRangeInput[] | null;
  }): Promise<UnsecuredDto<TDto>> {
    const { id, name, scriptureReferences } = changes;
    await this.updateColumns(id, {
      name,
      ...(scriptureReferences !== undefined && {
        scriptureReferences: (scriptureReferences ?? []).map(
          ScriptureRange.fromReferences,
        ),
      }),
    }).catch(
      catchUniqueViolation(
        'producibles_type_name_active_unique',
        'name',
        `${this.type} with this name already exists`,
      ),
    );
    return await this.readOne(id);
  }

  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<TDto>>> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(producibles)
      .where(
        and(
          inArray(producibles.id, [...ids]),
          eq(producibles.type, this.type),
          isNull(producibles.deletedAt),
        ),
      );
    return rows.map((row) => this.toDto(row));
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  async list(input: {
    sort: string;
    order: Order;
    page: number;
    count: number;
  }): Promise<PaginatedListType<UnsecuredDto<TDto>>> {
    const sortColumns = {
      name: producibles.name,
      createdAt: producibles.createdAt,
    } satisfies SortMap<string>;
    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(
        eq(producibles.type, this.type),
        isNull(producibles.deletedAt),
      ),
      orderBy: resolveOrderBy(input, sortColumns, producibles.name),
      page: input.page,
      count: input.count,
    });
    return { total, hasMore, items: rows.map((row) => this.toDto(row)) };
  }

  protected toDto(row: typeof producibles.$inferSelect): UnsecuredDto<TDto> {
    const dto: unknown = {
      id: row.id,
      __typename: this.type,
      createdAt: DateTime.fromJSDate(row.createdAt),
      name: row.name,
      scriptureReferences: parseRefs(row.scriptureReferences),
      canDelete: true,
    };
    return dto as UnsecuredDto<TDto>;
  }
}
