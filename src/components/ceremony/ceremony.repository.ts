import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { CalendarDate, generateId, type ID, type UnsecuredDto } from '~/common';
import { Identity } from '~/core/authentication';
import {
  collateDisplayOrder,
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
export class CeremonyRepository extends DrizzleDtoRepository<
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
    engagementId: ID<'Engagement'>,
  ): Promise<{ id: ID }> {
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
    const conditions: SQL[] = [
      isNull(ceremonies.deletedAt),
      // Keep this page/total in sync with liveCeremonyIds() below — without
      // it, a ceremony under a soft-deleted engagement/project inflates
      // `total` and consumes a page slot that readMany() then silently
      // drops, short-changing the page.
      sql`exists (
        select 1 from ${engagements}
        inner join ${projects} on ${projects.id} = ${engagements.projectId}
        where ${engagements.id} = ${ceremonies.engagementId}
          and ${engagements.deletedAt} is null
          and ${projects.deletedAt} is null
      )`,
    ];
    // Without the read filter, member/sensitivity-gated roles could list
    // ceremonies of unreadable projects. (readMany stays unfiltered, as it
    // always has.)
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
      /**
       * `CeremonyListInput`'s OWN default sort, so every unsorted ceremony
       * list was landing on the `createdAt` fallback here while Neo4j ordered
       * by the project's name (its `sorting()` call declares a `projectName`
       * matcher).
       *
       * Collated like every other text sort (decided 2026-09-15). Neo4j ordered
       * this key by raw code points, so this is a deliberate divergence from
       * it.
       */
      projectName: collateDisplayOrder(sql`(
        select ${projects.name} from ${projects}
        inner join ${engagements}
          on ${engagements.projectId} = ${projects.id}
        where ${engagements.id} = ${ceremonies.engagementId}
          and ${engagements.deletedAt} is null
          and ${projects.deletedAt} is null
      )`),
    } satisfies SortMap<keyof Ceremony | 'projectName'>;
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
      canDelete: true,
      scope,
    };
    return dto as UnsecuredDto<Ceremony>;
  }
}
