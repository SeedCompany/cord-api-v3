import { Injectable } from '@nestjs/common';
import { and, eq, ilike, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  NotFoundException,
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
} from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import { tools } from '~/core/drizzle/schema';
import { PolicyExecutor } from '../../authorization/policy/executor/policy-executor';
import {
  type CreateTool,
  Tool,
  type ToolFilters,
  type ToolListInput,
  type UpdateTool,
} from './dto';
import { type ToolKey } from './dto/tool-key.enum';

const catchNameUnique = catchUniqueViolation(
  'tools_name',
  'name',
  'Tool with this name already exists.',
);
const catchKeyUnique = catchUniqueViolation(
  'tools_key_unique',
  'key',
  'Key is already assigned to another tool.',
);

@Injectable()
export class ToolDrizzleRepository extends DrizzleDtoRepository<
  typeof tools,
  Tool
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
  ) {
    super(db, tools, Tool);
  }

  async create(input: CreateTool): Promise<UnsecuredDto<Tool>> {
    const id = await generateId();
    await this.db
      .insert(tools)
      .values({
        id,
        name: input.name,
        description: input.description,
        aiBased: input.aiBased,
        key: input.key,
      })
      .catch(catchKeyUnique)
      .catch(catchNameUnique);
    return await this.readOne(id);
  }

  async update(changes: UpdateTool): Promise<UnsecuredDto<Tool>> {
    const { id, ...fields } = changes;
    await this.updateColumns(id, {
      name: fields.name,
      description: fields.description,
      aiBased: fields.aiBased,
      key: fields.key,
    })
      .catch(catchKeyUnique)
      .catch(catchNameUnique);
    return await this.readOne(id);
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  async list(
    input: ToolListInput,
  ): Promise<PaginatedListType<UnsecuredDto<Tool>>> {
    const conditions: SQL[] = [
      isNull(tools.deletedAt),
      ...toolFilterClauses(this.db, input.filter),
    ];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }

    const sortColumns = {
      name: tools.name,
      createdAt: tools.createdAt,
    } satisfies SortMap<keyof Tool>;

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, tools.name),
      page: input.page,
      count: input.count,
    });
    return {
      total,
      items: rows.map((row) => this.toDto(row)),
      hasMore,
    };
  }

  async idByKey(key: ToolKey): Promise<ID<'Tool'>> {
    const rows = await this.db
      .select({ id: tools.id })
      .from(tools)
      .where(and(eq(tools.key, key), isNull(tools.deletedAt)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException('Tool not found', 'key');
    return row.id;
  }

  protected toDto(row: typeof tools.$inferSelect): UnsecuredDto<Tool> {
    return {
      id: row.id,
      __typename: 'Tool',
      createdAt: DateTime.fromJSDate(row.createdAt),
      name: row.name,
      description: row.description,
      aiBased: row.aiBased,
      key: row.key,
    };
  }
}

/**
 * Build the column-level WHERE clauses for a `ToolFilters` input against the
 * `tools` table. Reusable from sub-filters in other domains (e.g. ToolUsage's
 * `tool` filter once it is migrated).
 */
export const toolFilterClauses = (
  _db: DrizzleDb,
  filter: ToolFilters | undefined,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;
  if (filter.id) conditions.push(eq(tools.id, filter.id));
  if (filter.name) {
    conditions.push(ilike(tools.name, `%${escapeLikePattern(filter.name)}%`));
  }
  return conditions;
};
