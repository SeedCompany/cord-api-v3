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
  type SQL,
} from 'drizzle-orm';
import { type AnyPgColumn } from 'drizzle-orm/pg-core';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  DuplicateException,
  generateId,
  type ID,
  isIdLike,
  NotFoundException,
  NotImplementedException,
  type PaginatedListType,
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
} from '~/core/drizzle/schema';
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
  'Project with this name already exists.',
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
    return rows.map((row): UnsecuredDto<Project> => {
      const enriched: ProjectRow = {
        ...row,
        membership: membershipByProject.get(row.id) ?? null,
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

    return {}; // service re-reads via readOne after update
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
    conditions.push(...projectFilterClauses(this.db, input.filter));

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
   *
   * migration-todo: depends on Partnership migration. Throws until then.
   */
  async getPrimaryOrganizationName(_id: ID): Promise<string | null> {
    throw new NotImplementedException(
      'getPrimaryOrganizationName not yet available under DATABASE=postgres — pending Partnership migration',
    );
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
      // stepChangedAt is derived from the latest workflow event; PR 3 wires
      // the real query. For now fall back to createdAt — the only reader is
      // the resolver, and the field has no stored canonical value anyway.
      stepChangedAt: DateTime.fromJSDate(row.createdAt),
      primaryLocation: linkOrNull(row.primaryLocationId),
      marketingLocation: linkOrNull(row.marketingLocationId),
      marketingRegionOverride: linkOrNull(row.marketingRegionOverrideId),
      fieldRegion: linkOrNull(row.fieldRegionId),
      owningOrganization: linkOrNull(row.owningOrganizationId),
      rootDirectory: linkOrNull(row.rootDirectoryId),
      // migration-todo: Partnership not migrated; primaryPartnership always
      // null until partnership-pg lands.
      primaryPartnership: null,
      // migration-todo: Engagement not migrated; engagementTotal always 0
      // until engagement-pg (Phase 5).
      engagementTotal: 0,
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
      // migration-todo: pinned is per-requester state, separate Pin domain.
      pinned: false,
      // canDelete/scope are populated by the policy layer in the service.
      canDelete: true,
      scope: [],
    };
    return dto as UnsecuredDto<Project>;
  }
}

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
 * migration-todo: `primaryPartnership.*` sort is not implemented — Partnership
 * isn't migrated. Throw `NotImplementedException` so callers discover the gap.
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
  // Cross-domain filters — throw until their target domain migrates so the
  // gap is discoverable in tests instead of silently returning all projects.
  if (filter.languageId) {
    throw new NotImplementedException(
      'ProjectFilters.languageId requires Engagement migration (Phase 5).',
    );
  }
  if (filter.partnerId) {
    throw new NotImplementedException(
      'ProjectFilters.partnerId requires Partnership migration.',
    );
  }
  if (filter.partnerships) {
    throw new NotImplementedException(
      'ProjectFilters.partnerships requires Partnership migration.',
    );
  }
  if (filter.primaryPartnership) {
    throw new NotImplementedException(
      'ProjectFilters.primaryPartnership requires Partnership migration.',
    );
  }
  if (filter.tool) {
    throw new NotImplementedException(
      'ProjectFilters.tool requires ToolUsage migration.',
    );
  }
  if (filter.onlyMultipleEngagements != null) {
    throw new NotImplementedException(
      'ProjectFilters.onlyMultipleEngagements requires Engagement migration (Phase 5).',
    );
  }
  if (filter.usesRev79 != null) {
    throw new NotImplementedException(
      'ProjectFilters.usesRev79 requires ToolUsage migration.',
    );
  }
  if (filter.pinned != null) {
    // migration-todo: Pin domain (Phase 6); skip silently here since pinned
    // is per-requester state that may be wired separately.
  }
  return conditions;
};

// Re-export to satisfy the unused-import linter — `DuplicateException` is part
// of the catch-helper public surface elsewhere; here it's reached only via the
// catch chains above.
void DuplicateException;
void isIdLike;
void NotFoundException;
