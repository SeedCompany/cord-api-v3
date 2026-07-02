import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  max,
  sql,
  type SQL,
} from 'drizzle-orm';
import { type AnyPgColumn } from 'drizzle-orm/pg-core';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DuplicateException,
  generateId,
  type ID,
  NotFoundException,
  NotImplementedException,
  type PaginatedListType,
  type Role,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { ConfigService } from '~/core/config';
import {
  catchUniqueViolation,
  DrizzleDtoRepository,
  EMPTY_PAGE,
  escapeLikePattern,
  resolveOrderBy,
  type SortMap,
  subFilter,
} from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  fieldRegions,
  locations,
  projectMembers,
  projects,
  projectWorkflowEvents,
} from '~/core/drizzle/schema';
import { rolesForScope } from '../authorization/dto/role.dto';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import {
  fieldRegionFilterClauses,
  fieldRegionSortColumns,
} from '../field-region/field-region.drizzle.repository';
import {
  locationFilterClauses,
  locationSortColumns,
} from '../location/location.drizzle.repository';
import {
  type CreateProject,
  IProject,
  type Project,
  type ProjectFilters,
  type ProjectListInput,
  type UpdateProject,
} from './dto';
import { projectMemberFilterClauses } from './project-member/project-member.drizzle.repository';

const catchNameUnique = catchUniqueViolation(
  'projects_name_active_unique',
  'name',
  'Project with this name already exists',
);
const catchDepartmentIdUnique = catchUniqueViolation(
  'projects_department_id_active_unique',
  'departmentId',
  'Another Project with this Department ID already exists.',
);

/**
 * Hydrated Project row: the projects table row + the current user's membership
 * (id, roles, inactive_at) if any. Pulled together in a single SELECT for
 * `readMany`. Cross-domain stubs (engagementTotal, usesRev79, primaryPartnership,
 * rootDirectory) live in `toDto`.
 */
type ProjectRow = typeof projects.$inferSelect & {
  engagementTotal?: number;
  /** Latest workflow-event `at`, if any — batched in `readMany`. */
  stepChangedAt?: Date | null;
  membership?: {
    id: ID<'ProjectMember'>;
    roles: readonly string[];
    inactiveAt: Date | null;
  } | null;
};

@Injectable()
export class ProjectDrizzleRepository extends DrizzleDtoRepository<
  typeof projects,
  Project
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
    private readonly identity: Identity,
    private readonly config: ConfigService,
  ) {
    super(db, projects, IProject);
  }

  // migration-todo: Neo4j-shaped existence check kept for the service layer's
  // validateOtherResourceId. Only the labels project create/update actually
  // validates are mapped; extend if a new label appears. Replace with a
  // shared exists() helper at Phase 7 cutover when getBaseNode leaves the
  // service layer.
  async getBaseNode(id: ID, label?: string) {
    if (label === 'FieldRegion') {
      return await this.db.query.fieldRegions.findFirst({
        where: (fr) =>
          and(eq(fr.id, id as ID<'FieldRegion'>), isNull(fr.deletedAt)),
        columns: { id: true },
      });
    }
    if (label === 'Location') {
      return await this.db.query.locations.findFirst({
        where: (l) => and(eq(l.id, id as ID<'Location'>), isNull(l.deletedAt)),
        columns: { id: true },
      });
    }
    throw new NotImplementedException(
      `getBaseNode existence check for label "${String(label)}" under postgres`,
    );
  }

  override async readMany(
    ids: readonly ID[],
    _changeset?: ID,
  ): Promise<Array<UnsecuredDto<Project>>> {
    // Param accepted for splitDb signature parity with the Neo4j/Gel repos.
    // PCR/Changeset is excluded from the migration entirely, so a changeset
    // view collapses to the canonical row — the arg is silently ignored.
    if (ids.length === 0) return [];
    const userId = this.identity.current.userId;
    const rows = await this.db.query.projects.findMany({
      where: (p) => and(inArray(p.id, [...ids]), isNull(p.deletedAt)),
    });
    if (rows.length === 0) return [];

    // Pull the requesting user's memberships in one query, then attach.
    const memberships = await this.db
      .select({
        id: projectMembers.id,
        projectId: projectMembers.projectId,
        roles: projectMembers.roles,
        inactiveAt: projectMembers.inactiveAt,
      })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.userId, userId),
          isNull(projectMembers.deletedAt),
        ),
      );
    const membershipByProject = new Map(
      memberships.map((m) => [m.projectId, m]),
    );
    // Latest workflow-event timestamp per project — `stepChangedAt` derives
    // from it at read time (toDto falls back to createdAt, matching Gel's
    // `latestWorkflowEvent.at ?? createdAt`). Served by the
    // (project_id, at DESC) index; events are append-only (no soft delete).
    const latestEvents = await this.db
      .select({
        projectId: projectWorkflowEvents.projectId,
        at: max(projectWorkflowEvents.at),
      })
      .from(projectWorkflowEvents)
      .where(inArray(projectWorkflowEvents.projectId, [...ids]))
      .groupBy(projectWorkflowEvents.projectId);
    const stepChangedByProject = new Map(
      latestEvents.map((e) => [e.projectId, e.at]),
    );
    // migration-todo: engagementTotal is stubbed to 0 until Engagement migrates
    // (the `engagements` table isn't on develop yet). `pinned` dropped — Pin
    // isn't migrated; re-add the pinnedByRequester batch when the pin domain ports.
    return rows.map((row): UnsecuredDto<Project> => {
      const enriched: ProjectRow = {
        ...row,
        membership: membershipByProject.get(row.id) ?? null,
        stepChangedAt: stepChangedByProject.get(row.id) ?? null,
        engagementTotal: 0,
      };
      return this.toDto(enriched);
    });
  }

  async create(input: CreateProject): Promise<{ id: ID<'Project'> }> {
    const id = await generateId<ID<'Project'>>();
    // migration-note: `step` defaults to EarlyConversations via the schema
    // column default. SetInitialMouEnd (Created hook) and SetDepartmentId
    // (Transitioned hook) get their PG paths in the workflow PR
    // (`project-workflow-pg`); no inline wiring needed here.
    await this.db
      .insert(projects)
      .values({
        id,
        type: input.type,
        name: input.name,
        // Internship-only writable; Translation rows leave it null and read
        // the denormalized `sensitivity` column.
        ownSensitivity:
          input.type === 'Internship' ? (input.sensitivity ?? 'High') : null,
        // For Internship: keep `sensitivity` in lockstep with own_sensitivity
        // on create. For Translation: 'High' default (migration-todo: hook
        // recomputes when Engagement/Language migrates).
        sensitivity:
          input.type === 'Internship' ? (input.sensitivity ?? 'High') : 'High',
        primaryLocationId: input.primaryLocation ?? null,
        marketingLocationId: input.marketingLocation ?? null,
        marketingRegionOverrideId: input.marketingRegionOverride ?? null,
        fieldRegionId: input.fieldRegion ?? null,
        owningOrganizationId: this.config.defaultOrg.id as ID<'Organization'>,
        mouStart: input.mouStart ? input.mouStart.toSQLDate() : null,
        mouEnd: input.mouEnd ? input.mouEnd.toSQLDate() : null,
        estimatedSubmission: input.estimatedSubmission
          ? input.estimatedSubmission.toSQLDate()
          : null,
        tags: input.tags ? [...input.tags] : [],
        financialReportReceivedAt:
          input.financialReportReceivedAt?.toJSDate() ?? null,
        financialReportPeriod: input.financialReportPeriod ?? null,
        presetInventory: input.presetInventory ?? false,
        departmentId: input.departmentId ?? null,
        rev79ProjectId: input.rev79ProjectId ?? null,
      })
      .catch(catchDepartmentIdUnique)
      .catch(catchNameUnique);
    // migration-todo (PR 2 follow-up): `otherLocations` are still managed by
    // LocationService against Neo4j. Once the location service ports, wire a
    // `project_other_locations` junction or move the loop here.
    return { id };
  }

  async update(
    existing: UnsecuredDto<Project>,
    changes: Partial<UpdateProject>,
    _changeset?: ID,
  ): Promise<Partial<UnsecuredDto<Project>>> {
    // Param accepted for splitDb signature parity. PCR is excluded; under
    // a changeset view we still write through to the row directly (no
    // staging side table). Acceptable because DATABASE=postgres is dev-only
    // and no changeset machinery exists in this branch.
    const {
      id: _id,
      changeset: _cs,
      primaryLocation,
      marketingLocation,
      marketingRegionOverride,
      fieldRegion,
      mouStart,
      mouEnd,
      initialMouEnd,
      estimatedSubmission,
      financialReportReceivedAt,
      sensitivity,
      tags,
      usesRev79: _usesRev79,
      ...simpleChanges
    } = changes;

    await this.updateColumns(existing.id, {
      ...simpleChanges,
      ...(primaryLocation !== undefined && {
        primaryLocationId: primaryLocation,
      }),
      ...(marketingLocation !== undefined && {
        marketingLocationId: marketingLocation,
      }),
      ...(marketingRegionOverride !== undefined && {
        marketingRegionOverrideId: marketingRegionOverride,
      }),
      ...(fieldRegion !== undefined && { fieldRegionId: fieldRegion }),
      ...(mouStart !== undefined && {
        mouStart: mouStart ? mouStart.toSQLDate() : null,
      }),
      ...(mouEnd !== undefined && {
        mouEnd: mouEnd ? mouEnd.toSQLDate() : null,
      }),
      ...(initialMouEnd !== undefined && {
        initialMouEnd: initialMouEnd ? initialMouEnd.toSQLDate() : null,
      }),
      ...(estimatedSubmission !== undefined && {
        estimatedSubmission: estimatedSubmission
          ? estimatedSubmission.toSQLDate()
          : null,
      }),
      ...(financialReportReceivedAt !== undefined && {
        financialReportReceivedAt:
          financialReportReceivedAt?.toJSDate() ?? null,
      }),
      ...(tags !== undefined && { tags: [...tags] }),
      // Internship: writable. Translation: ignored (denormalized from
      // engagements; recompute hook lands when Language migrates).
      ...(sensitivity !== undefined &&
        existing.type === 'Internship' && {
          ownSensitivity: sensitivity,
          sensitivity,
        }),
      modifiedAt: new Date(),
    }).catch(catchDepartmentIdUnique);

    // migration-todo: usesRev79 toggle delegates to ToolUsage service (not
    // migrated yet). When ToolUsage ports, wire the create/remove of the
    // Rev79 ToolUsage row here.

    // The service runs RequiredWhen.calc against this return value, so it
    // must be the full updated DTO — not a stub.
    return await this.readOne(existing.id);
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  async list(
    input: ProjectListInput,
  ): Promise<PaginatedListType<UnsecuredDto<Project>>> {
    const conditions: SQL[] = [isNull(projects.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }
    conditions.push(
      ...projectFilterClauses(
        this.db,
        input.filter,
        this.identity.current.userId,
      ),
    );

    const allConditions = and(...conditions);
    const sort = input.sort as string;
    const direction = input.order === 'ASC' ? asc : desc;

    // Cross-domain JOIN-sort — mirror of the partner repo's pattern. When a
    // second consumer needs the same prefix-strip + sortColumn-resolve dance,
    // extract `resolveCrossDomainSort` (per partner's migration-todo).
    const joinSort = resolveCrossDomainSort(sort);

    let pageIds: ReadonlyArray<{ id: ID<'Project'> }>;
    let total: number;
    if (joinSort) {
      const offset = (input.page - 1) * input.count;
      const [countResult, joined] = await Promise.all([
        this.db.select({ total: count() }).from(projects).where(allConditions),
        this.db
          .select({ id: projects.id })
          .from(projects)
          .leftJoin(joinSort.table, eq(joinSort.fkColumn, joinSort.table.id))
          .where(allConditions)
          .orderBy(direction(joinSort.column), asc(projects.id))
          .limit(input.count)
          .offset(offset),
      ]);
      total = countResult[0]?.total ?? 0;
      pageIds = joined;
    } else {
      const sortColumns = projectSortColumns;
      // Reject unknown/unmapped own-table sort keys instead of silently
      // falling back to createdAt (resolveOrderBy's `map[sort] ?? fallback`).
      // Mirrors the Partner repo guard.
      if (!(sort in sortColumns)) {
        throw new NotImplementedException(
          `Sorting projects by '${sort}' is not supported.`,
        );
      }
      const page = await this.paginatedSelect({
        predicate: allConditions,
        orderBy: resolveOrderBy(input, sortColumns, projects.createdAt),
        page: input.page,
        count: input.count,
      });
      pageIds = page.rows.map((r) => ({ id: r.id }));
      total = page.total;
    }

    const offset = (input.page - 1) * input.count;
    const hasMore = offset + pageIds.length < total;
    if (pageIds.length === 0) return { total, items: [], hasMore };

    const dtos = await this.readMany(pageIds.map((r) => r.id));
    const byId = new Map(dtos.map((d) => [d.id, d]));
    return {
      total,
      items: pageIds.flatMap((r) => byId.get(r.id) ?? []),
      hasMore,
    };
  }

  /**
   * Resolve the primary partnership's owning organization name. Used by the
   * Rev79 integration. Traverses partnerships → partners → organizations.
   */
  async getPrimaryOrganizationName(id: ID): Promise<string | null> {
    const rows = await this.db.execute<{ name: string }>(sql`
      select "o"."name" from "partnerships" "ps"
      join "partners" "pt" on "pt"."id" = "ps"."partner_id"
      join "organizations" "o" on "o"."id" = "pt"."organization_id"
      where "ps"."project_id" = ${id}
        and "ps"."primary" = true
        and "ps"."deleted_at" is null
      limit 1
    `);
    return rows.rows[0]?.name ?? null;
  }

  protected toDto(row: ProjectRow): UnsecuredDto<Project> {
    const linkOrNull = <T extends string>(id: ID<T> | null | undefined) =>
      id ? { id } : null;
    // DTO shape includes a few service-layer overlays (canDelete, scope,
    // pinned) and stub fields the repo can't compute under DATABASE=postgres
    // yet (primaryPartnership, engagementTotal, usesRev79). Build the dto as
    // `unknown` first so the lint stays clean — service runs
    // `privileges.secure()` after this anyway.
    const dto: unknown = {
      id: row.id,
      __typename:
        row.type === 'Internship'
          ? 'InternshipProject'
          : row.type === 'MomentumTranslation'
            ? 'MomentumTranslationProject'
            : 'MultiplicationTranslationProject',
      type: row.type,
      name: row.name,
      step: row.step,
      status: row.status,
      sensitivity: row.sensitivity,
      rev79ProjectId: row.rev79ProjectId ?? null,
      departmentId: row.departmentId ?? null,
      mouStart: row.mouStart ? CalendarDate.fromISO(row.mouStart) : null,
      mouEnd: row.mouEnd ? CalendarDate.fromISO(row.mouEnd) : null,
      initialMouEnd: row.initialMouEnd
        ? CalendarDate.fromISO(row.initialMouEnd)
        : null,
      estimatedSubmission: row.estimatedSubmission
        ? CalendarDate.fromISO(row.estimatedSubmission)
        : null,
      financialReportReceivedAt: row.financialReportReceivedAt
        ? DateTime.fromJSDate(row.financialReportReceivedAt)
        : null,
      financialReportPeriod: row.financialReportPeriod ?? null,
      tags: row.tags,
      presetInventory: row.presetInventory,
      createdAt: DateTime.fromJSDate(row.createdAt),
      modifiedAt: DateTime.fromJSDate(row.modifiedAt),
      // Derived from the latest workflow event (batched in readMany), falling
      // back to createdAt — Gel parity: `latestWorkflowEvent.at ?? createdAt`.
      stepChangedAt: DateTime.fromJSDate(row.stepChangedAt ?? row.createdAt),
      primaryLocation: linkOrNull(row.primaryLocationId),
      marketingLocation: linkOrNull(row.marketingLocationId),
      marketingRegionOverride: linkOrNull(row.marketingRegionOverrideId),
      fieldRegion: linkOrNull(row.fieldRegionId),
      owningOrganization: linkOrNull(row.owningOrganizationId),
      rootDirectory: linkOrNull(row.rootDirectoryId),
      // migration-todo: Partnership is on develop, but per-project
      // primaryPartnership hydration is not yet wired (mono stubs it null too).
      // Wire via a `partnerships` subquery (primary = true) as a follow-up.
      primaryPartnership: null,
      engagementTotal: row.engagementTotal ?? 0,
      // migration-todo: ToolUsage not migrated; usesRev79 always false until
      // the tool-usage layer ports.
      usesRev79: false,
      membership: row.membership
        ? {
            id: row.membership.id,
            roles: [...row.membership.roles],
            inactiveAt: row.membership.inactiveAt
              ? DateTime.fromJSDate(row.membership.inactiveAt)
              : null,
          }
        : null,
      // `changeset` is a resolver navigation marker — populated from request
      // context, not stored on the row. PCR is excluded from the migration,
      // so it stays undefined here.
      changeset: undefined,
      // migration-todo: Pin not migrated; pinned is false until the pin domain
      // ports (then re-add the pinnedByRequester batch in readMany).
      pinned: false,
      // canDelete is populated by the policy layer in the service.
      canDelete: true,
      // Scoped roles from the requesting user's active membership — the
      // `member` policy conditions read `object.scope` directly. Mirror of
      // Neo4j's matchProjectScopedRoles: the 'member:true' marker plus the
      // membership roles project-scoped.
      scope:
        row.membership && !row.membership.inactiveAt
          ? [
              'member:true' as const,
              ...(row.membership.roles as readonly Role[]).map(
                rolesForScope('project'),
              ),
            ]
          : [],
    };
    return dto as UnsecuredDto<Project>;
  }
}

/**
 * Recompute the denormalized `projects.sensitivity` for translation projects
 * from their engaged languages — max(language sensitivity) ?? High. Mirror of
 * Gel's recalculateProjectSens triggers; called from the engagement/language
 * drizzle repos whenever the inputs change (create/delete engagement,
 * language sensitivity update). Internship projects are untouched — they
 * read own_sensitivity.
 */
export const recomputeProjectSensitivity = async (
  db: DrizzleDb,
  projectIds: ReadonlyArray<ID<'Project'>>,
) => {
  if (projectIds.length === 0) return;
  // migration-todo: INERT on develop — references `engagements`/`languages`
  // (not migrated), and nothing calls this until the Engagement/Language repos
  // do. Kept exported so those repos wire it without a new export. The raw SQL
  // compiles (string table names); it would only fail if invoked pre-migration.
  await db.execute(sql`
    update "projects" set "sensitivity" = coalesce((
      select max("l"."sensitivity") from "engagements" "e"
      join "languages" "l" on "l"."id" = "e"."language_id"
      where "e"."project_id" = "projects"."id"
        and "e"."deleted_at" is null
        and "l"."deleted_at" is null
    ), 'High')
    where "id" in (${sql.join(
      projectIds.map((id) => sql`${id}`),
      sql`, `,
    )})
      and "type" <> 'Internship'
  `);
};

/**
 * Sortable columns on `projects` itself. Cross-domain sorts (primaryLocation.*,
 * fieldRegion.*) are resolved in `resolveCrossDomainSort` and routed through a
 * hand-rolled INNER JOIN — same pattern as Partner's organization sort.
 */
export const projectSortColumns = {
  id: projects.id,
  name: projects.name,
  createdAt: projects.createdAt,
  modifiedAt: projects.modifiedAt,
  step: projects.step,
  status: projects.status,
  type: projects.type,
  sensitivity: projects.sensitivity,
  mouStart: projects.mouStart,
  mouEnd: projects.mouEnd,
  estimatedSubmission: projects.estimatedSubmission,
  departmentId: projects.departmentId,
} satisfies SortMap<keyof Project>;

/**
 * Resolve a `prefix.field`-style sort key to its (sub-table, FK, sub-column).
 * Returns `null` when the sort is column-local (handled by paginatedSelect).
 *
 * migration-todo: when a second consumer needs this same prefix-strip dance
 * (Partnership → `partner.*`, Engagement → `project.*`), extract a shared
 * `resolveCrossDomainSort(sort, prefix, sortColumns)` helper alongside
 * `paginatedSelectWithJoin` (mirror of `*FilterClauses` emergence).
 *
 * migration-todo: `primaryPartnership.*` sort is not implemented. Partnership
 * is on develop now, but mono leaves this sort stubbed too; wire it as a
 * follow-up. Throw `NotImplementedException` so callers discover the gap.
 */
const resolveCrossDomainSort = (
  sort: string,
): {
  table: typeof locations | typeof fieldRegions;
  fkColumn: AnyPgColumn;
  column: AnyPgColumn;
} | null => {
  if (sort.startsWith('primaryLocation.')) {
    const key = sort.slice('primaryLocation.'.length);
    const column = locationSortColumns[key as keyof typeof locationSortColumns];
    if (!column) {
      throw new NotImplementedException(
        `Sorting projects by '${sort}' is not supported — '${key}' is not a known sortable column on locations.`,
      );
    }
    return { table: locations, fkColumn: projects.primaryLocationId, column };
  }
  if (sort.startsWith('fieldRegion.')) {
    const key = sort.slice('fieldRegion.'.length);
    const column =
      fieldRegionSortColumns[key as keyof typeof fieldRegionSortColumns];
    if (!column) {
      throw new NotImplementedException(
        `Sorting projects by '${sort}' is not supported — '${key}' is not a known sortable column on field_regions.`,
      );
    }
    return { table: fieldRegions, fkColumn: projects.fieldRegionId, column };
  }
  if (sort.startsWith('primaryPartnership.')) {
    throw new NotImplementedException(
      `Sorting projects by '${sort}' is not yet supported under DATABASE=postgres — pending Partnership migration.`,
    );
  }
  return null;
};

/**
 * Build the column-level WHERE clauses for a `ProjectFilters` input against
 * `projects`. Exported for sub-delegation from other domains (Engagement and
 * Partnership both filter-sub-delegate into projectFilterClauses).
 *
 * Cross-domain stubs (languageId, partnerId, partnerships, primaryPartnership,
 * tool, onlyMultipleEngagements, usesRev79) throw NotImplementedException
 * until their target domain migrates — discovery mechanism, not silent skip.
 */
export const projectFilterClauses = (
  db: DrizzleDb,
  filter: ProjectFilters | undefined,
  // migration-todo: dead after the pin strip; kept for signature stability.
  // list() still passes identity.current.userId harmlessly. Re-consume when Pin ports.
  _requesterId?: ID<'User'>,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;

  if (filter.id) conditions.push(eq(projects.id, filter.id));
  if (filter.type?.length) {
    conditions.push(inArray(projects.type, filter.type));
  }
  if (filter.status?.length) {
    conditions.push(inArray(projects.status, filter.status));
  }
  if (filter.step?.length) {
    conditions.push(inArray(projects.step, filter.step));
  }
  if (filter.sensitivity?.length) {
    conditions.push(inArray(projects.sensitivity, [...filter.sensitivity]));
  }
  if (filter.presetInventory !== undefined) {
    conditions.push(eq(projects.presetInventory, filter.presetInventory));
  }
  if (filter.name) {
    conditions.push(
      ilike(projects.name, `%${escapeLikePattern(filter.name)}%`),
    );
  }
  if (filter.createdAt) {
    if (filter.createdAt.after) {
      conditions.push(
        gt(projects.createdAt, filter.createdAt.after.toJSDate()),
      );
    }
    if (filter.createdAt.afterInclusive) {
      conditions.push(
        gte(projects.createdAt, filter.createdAt.afterInclusive.toJSDate()),
      );
    }
    if (filter.createdAt.before) {
      conditions.push(
        lt(projects.createdAt, filter.createdAt.before.toJSDate()),
      );
    }
    if (filter.createdAt.beforeInclusive) {
      conditions.push(
        lte(projects.createdAt, filter.createdAt.beforeInclusive.toJSDate()),
      );
    }
  }
  if (filter.modifiedAt) {
    if (filter.modifiedAt.after) {
      conditions.push(
        gt(projects.modifiedAt, filter.modifiedAt.after.toJSDate()),
      );
    }
    if (filter.modifiedAt.afterInclusive) {
      conditions.push(
        gte(projects.modifiedAt, filter.modifiedAt.afterInclusive.toJSDate()),
      );
    }
    if (filter.modifiedAt.before) {
      conditions.push(
        lt(projects.modifiedAt, filter.modifiedAt.before.toJSDate()),
      );
    }
    if (filter.modifiedAt.beforeInclusive) {
      conditions.push(
        lte(projects.modifiedAt, filter.modifiedAt.beforeInclusive.toJSDate()),
      );
    }
  }
  if (filter.mouStart) {
    if (filter.mouStart.after) {
      conditions.push(
        gt(projects.mouStart, filter.mouStart.after.toSQLDate()!),
      );
    }
    if (filter.mouStart.afterInclusive) {
      conditions.push(
        gte(projects.mouStart, filter.mouStart.afterInclusive.toSQLDate()!),
      );
    }
    if (filter.mouStart.before) {
      conditions.push(
        lt(projects.mouStart, filter.mouStart.before.toSQLDate()!),
      );
    }
    if (filter.mouStart.beforeInclusive) {
      conditions.push(
        lte(projects.mouStart, filter.mouStart.beforeInclusive.toSQLDate()!),
      );
    }
  }
  if (filter.mouEnd) {
    if (filter.mouEnd.after) {
      conditions.push(gt(projects.mouEnd, filter.mouEnd.after.toSQLDate()!));
    }
    if (filter.mouEnd.afterInclusive) {
      conditions.push(
        gte(projects.mouEnd, filter.mouEnd.afterInclusive.toSQLDate()!),
      );
    }
    if (filter.mouEnd.before) {
      conditions.push(lt(projects.mouEnd, filter.mouEnd.before.toSQLDate()!));
    }
    if (filter.mouEnd.beforeInclusive) {
      conditions.push(
        lte(projects.mouEnd, filter.mouEnd.beforeInclusive.toSQLDate()!),
      );
    }
  }
  if (filter.primaryLocation) {
    conditions.push(
      subFilter(
        db,
        projects.primaryLocationId,
        locations,
        locationFilterClauses(filter.primaryLocation),
      ),
    );
  }
  if (filter.fieldRegion) {
    conditions.push(
      subFilter(
        db,
        projects.fieldRegionId,
        fieldRegions,
        fieldRegionFilterClauses(db, filter.fieldRegion),
      ),
    );
  }
  // `members` and `membership` filters — links project → project_members via
  // a project-side `IN (SELECT project_id FROM project_members WHERE ...)`.
  // The members filter doesn't constrain user; membership scopes to the
  // current requester. Both lean on projectMemberFilterClauses.
  if (filter.members) {
    const sub = db
      .selectDistinct({ id: projectMembers.projectId })
      .from(projectMembers)
      .where(
        and(
          isNull(projectMembers.deletedAt),
          ...projectMemberFilterClauses(db, filter.members),
        ),
      );
    conditions.push(inArray(projects.id, sub));
  }
  if (filter.membership) {
    // Note: the `user: { id: $currentUser }` constraint is applied by the
    // resolver/transform layer (see ProjectFilters.membership transform).
    const sub = db
      .selectDistinct({ id: projectMembers.projectId })
      .from(projectMembers)
      .where(
        and(
          isNull(projectMembers.deletedAt),
          ...projectMemberFilterClauses(db, filter.membership),
        ),
      );
    conditions.push(inArray(projects.id, sub));
  }
  // `userId`: project where user is a member OR engagement intern. Intern path
  // is gated on Engagement migration — partial support: member only.
  if (filter.userId) {
    const memberSub = db
      .selectDistinct({ id: projectMembers.projectId })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.userId, filter.userId),
          isNull(projectMembers.deletedAt),
        ),
      );
    // migration-todo: when Engagement migrates, OR-in the intern path:
    //   ... OR projects.id IN (SELECT project_id FROM engagements WHERE intern_id = $userId)
    conditions.push(inArray(projects.id, memberSub));
  }
  if (filter.languageId) {
    // migration-todo: exists-over-engagements; Engagement isn't on develop.
    // Throw so the gap is discoverable (matches partnerId/partnerships below).
    throw new NotImplementedException(
      'ProjectFilters.languageId requires Engagement migration.',
    );
  }
  // Cross-domain filters — throw until wired so the gap is discoverable in
  // tests instead of silently returning all projects.
  //
  // migration-todo: Partnership is on develop now, so these three can be wired
  // via `subFilter(db, projects.id, partnerships, [...])` reusing the exported
  // `partnershipFilterClauses`. Mono leaves them stubbed too, so kept deferred
  // to a follow-up rather than writing new (untested-on-mono) filter SQL here.
  if (filter.partnerId) {
    throw new NotImplementedException(
      'ProjectFilters.partnerId is not yet wired under Postgres.',
    );
  }
  if (filter.partnerships) {
    throw new NotImplementedException(
      'ProjectFilters.partnerships is not yet wired under Postgres.',
    );
  }
  if (filter.primaryPartnership) {
    throw new NotImplementedException(
      'ProjectFilters.primaryPartnership is not yet wired under Postgres.',
    );
  }
  if (filter.tool) {
    // migration-todo: wire when ToolUsage migrates (exists-over-tool_usages).
    throw new NotImplementedException(
      'ProjectFilters.tool requires ToolUsage migration.',
    );
  }
  if (filter.onlyMultipleEngagements != null) {
    // migration-todo: wire when Engagement migrates (count-over-engagements).
    throw new NotImplementedException(
      'ProjectFilters.onlyMultipleEngagements requires Engagement migration (Phase 5).',
    );
  }
  if (filter.usesRev79 != null) {
    // migration-todo: wire when ToolUsage migrates (Rev79 tool usage check).
    throw new NotImplementedException(
      'ProjectFilters.usesRev79 requires ToolUsage migration.',
    );
  }
  if (filter.pinned != null) {
    // migration-todo: Pin not migrated. Re-add
    // `conditions.push(pinnedFilter(_requesterId, projects.id, filter.pinned))`
    // when the pin domain ports. Throw for now (matches the branches above).
    throw new NotImplementedException(
      'ProjectFilters.pinned requires Pin migration.',
    );
  }
  return conditions;
};

// Re-export to satisfy the unused-import linter — `DuplicateException` is part
// of the catch-helper public surface elsewhere; here it's reached only via the
// catch chains above.
void DuplicateException;
void NotFoundException;
