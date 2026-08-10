import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  generateId,
  type ID,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import {
  DrizzleDtoRepository,
  EMPTY_PAGE,
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { ceremonies, engagements, projects } from '~/core/drizzle/schema';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { requesterScopeByProject } from '../project/project-member/membership-scope';
import {
  Ceremony,
  type CeremonyListInput,
  type CreateCeremony,
  type UpdateCeremony,
} from './dto';

type CeremonyRow = typeof ceremonies.$inferSelect & {
  engagement?: Pick<typeof engagements.$inferSelect, 'id' | 'type'> & {
    project?: Pick<typeof projects.$inferSelect, 'id' | 'sensitivity'> | null;
  };
};

@Injectable()
export class CeremonyDrizzleRepository extends DrizzleDtoRepository<
  typeof ceremonies,
  Ceremony
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
    private readonly identity: Identity,
  ) {
    super(db, ceremonies, Ceremony);
  }

  async create(
    input: CreateCeremony,
    engagementId?: ID<'Engagement'>,
  ): Promise<{ id: ID }> {
    if (!engagementId) {
      // The Neo4j flow creates the node then connects it from the caller;
      // under postgres the FK is NOT NULL so the caller must pass it.
      throw new ServerException(
        'Ceremony creation under postgres requires the engagement id',
      );
    }
    const id = await generateId<ID<'Ceremony'>>();
    await this.db.insert(ceremonies).values({
      id,
      engagementId,
      type: input.type,
      planned: input.planned ?? false,
      estimatedDate: input.estimatedDate?.toSQLDate() ?? null,
      actualDate: input.actualDate?.toSQLDate() ?? null,
    });
    return { id };
  }

  /**
   * Of these ids, the ones whose engagement and project are both still live.
   *
   * A ceremony's own `deletedAt` says nothing about its parents: soft-deleting
   * the engagement or project leaves the ceremony's row untouched. Neo4j's
   * `hydrate()` requires a REQUIRED match up through `:Project`->`:Engagement`
   * (ACTIVE relationships), and soft delete there relabels to `Deleted_*`, so a
   * dead ancestor hides the ceremony entirely rather than returning it with a
   * dangling parent ref.
   */
  private async liveCeremonyIds(ids: readonly ID[]): Promise<ID[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select({ id: ceremonies.id })
      .from(ceremonies)
      .innerJoin(engagements, eq(engagements.id, ceremonies.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .where(
        and(
          inArray(ceremonies.id, [...ids]),
          isNull(engagements.deletedAt),
          isNull(projects.deletedAt),
        ),
      );
    return rows.map((row) => row.id);
  }

  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<Ceremony>>> {
    if (ids.length === 0) return [];
    const live = await this.liveCeremonyIds(ids);
    if (live.length === 0) return [];
    const rows = await this.db.query.ceremonies.findMany({
      where: (c) => and(inArray(c.id, [...live]), isNull(c.deletedAt)),
      with: {
        engagement: {
          // `type` feeds the parent ref's __typename (`${type}Engagement`).
          columns: { id: true, type: true },
          with: { project: { columns: { id: true, sensitivity: true } } },
        },
      },
    });
    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.flatMap((r) => r.engagement?.project?.id ?? []),
    );
    return (rows as CeremonyRow[]).map((row) =>
      this.toDto(
        row,
        row.engagement?.project
          ? (scopeByProject.get(row.engagement.project.id) ?? [])
          : [],
      ),
    );
  }

  async update(
    changes: UpdateCeremony & { id: ID },
  ): Promise<UnsecuredDto<Ceremony>> {
    const { id, ...fields } = changes;
    await this.updateColumns(id, {
      planned: fields.planned,
      ...(fields.estimatedDate !== undefined && {
        estimatedDate: fields.estimatedDate?.toSQLDate() ?? null,
      }),
      ...(fields.actualDate !== undefined && {
        actualDate: fields.actualDate?.toSQLDate() ?? null,
      }),
    });
    return await this.readOne(id);
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  async list(input: CeremonyListInput) {
    const conditions: SQL[] = [isNull(ceremonies.deletedAt)];
    // Mirror the Neo4j list()'s `filterToReadable` — without it, member/
    // sensitivity-gated roles could list ceremonies of unreadable projects.
    // (readMany stays unfiltered: the Neo4j readMany uses the base's opt-in
    // no-op filterManyToReadable, so unfiltered there is parity.)
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }
    if (input.filter?.type) {
      conditions.push(eq(ceremonies.type, input.filter.type));
    }
    const sortColumns = {
      type: ceremonies.type,
      planned: ceremonies.planned,
      estimatedDate: ceremonies.estimatedDate,
      actualDate: ceremonies.actualDate,
      createdAt: ceremonies.createdAt,
    } satisfies SortMap<keyof Ceremony>;
    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, ceremonies.createdAt),
      page: input.page,
      count: input.count,
    });
    if (rows.length === 0) return { total, items: [], hasMore };
    const items = await this.readMany(rows.map((r) => r.id));
    const byId = new Map(items.map((i) => [i.id, i]));
    return {
      total,
      items: rows.map((r) => byId.get(r.id)!).filter(Boolean),
      hasMore,
    };
  }

  protected toDto(
    row: CeremonyRow,
    scope: ScopedRole[] = [],
  ): UnsecuredDto<Ceremony> {
    if (!row.engagement?.project) {
      throw new Error(
        `Ceremony ${row.id} has no parent engagement/project row — FK invariant violated`,
      );
    }
    const dto: unknown = {
      id: row.id,
      __typename: 'Ceremony',
      createdAt: DateTime.fromJSDate(row.createdAt),
      type: row.type,
      planned: row.planned,
      estimatedDate: row.estimatedDate
        ? CalendarDate.fromISO(row.estimatedDate)
        : null,
      actualDate: row.actualDate ? CalendarDate.fromISO(row.actualDate) : null,
      sensitivity: row.engagement.project.sensitivity,
      engagement: { id: row.engagement.id },
      parent: {
        id: row.engagement.id,
        __typename: `${row.engagement.type}Engagement`,
      },
      canDelete: true,
      scope,
    };
    return dto as UnsecuredDto<Ceremony>;
  }
}
