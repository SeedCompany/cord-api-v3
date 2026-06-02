import { Injectable } from '@nestjs/common';
import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  type ID,
  isIdLike,
  NotFoundException,
  type PaginatedListType,
  type Role,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import {
  DrizzleDtoRepository,
  EMPTY_PAGE,
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  projectMembers,
  projects,
  type userGlobalRoles,
  users,
} from '~/core/drizzle/schema';
import { PolicyExecutor } from '../../authorization/policy/executor/policy-executor';
import {
  UserDrizzleRepository,
  userFilterClauses,
} from '../../user/user.drizzle.repository';
import { projectFilterClauses } from '../project.drizzle.repository';
import {
  type CreateProjectMember,
  ProjectMember,
  type ProjectMemberFilters,
  type ProjectMemberListInput,
  type UpdateProjectMember,
} from './dto';
import { type MembershipByProjectAndUserInput } from './membership-by-project-and-user.loader';

/**
 * Relational findMany row shape: the member row plus its parent project's
 * (`id`, `type`, `sensitivity`) and the full user with global roles. Drives
 * `toDto` — Project's sensitivity is inherited onto every ProjectMember DTO,
 * matching the Neo4j repo's `matchPropsAndProjectSensAndScopedRoles()` overlay.
 */
type ProjectMemberRow = typeof projectMembers.$inferSelect & {
  project: Pick<
    typeof projects.$inferSelect,
    'id' | 'type' | 'sensitivity'
  > | null;
  user: typeof users.$inferSelect & {
    globalRoles?: Array<typeof userGlobalRoles.$inferSelect>;
  };
};

@Injectable()
export class ProjectMemberDrizzleRepository extends DrizzleDtoRepository<
  typeof projectMembers,
  ProjectMember
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
    private readonly userRepo: UserDrizzleRepository,
  ) {
    super(db, projectMembers, ProjectMember);
  }

  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<ProjectMember>>> {
    if (ids.length === 0) return [];
    const rows = await this.db.query.projectMembers.findMany({
      where: (m) => and(inArray(m.id, [...ids]), isNull(m.deletedAt)),
      with: {
        project: { columns: { id: true, type: true, sensitivity: true } },
        user: { with: { globalRoles: true } },
      },
    });
    return (rows as ProjectMemberRow[]).map((row) => this.toDto(row));
  }

  async create(
    input: CreateProjectMember,
  ): Promise<UnsecuredDto<ProjectMember>> {
    const projectId = isIdLike(input.project)
      ? input.project
      : input.project.id;
    await this.verifyRelationshipEligibility(projectId, input.user);

    const id = await generateId<ID<'ProjectMember'>>();
    await this.db.insert(projectMembers).values({
      id,
      projectId,
      userId: input.user,
      roles: [...(input.roles ?? [])],
      inactiveAt: input.inactiveAt ? input.inactiveAt.toJSDate() : null,
    });
    return await this.readOne(id);
  }

  async update(
    input: UpdateProjectMember,
  ): Promise<UnsecuredDto<ProjectMember>> {
    const { id, ...changes } = input;
    await this.updateColumns(id, {
      ...(changes.roles !== undefined && { roles: [...changes.roles] }),
      ...(changes.inactiveAt !== undefined && {
        inactiveAt: changes.inactiveAt ? changes.inactiveAt.toJSDate() : null,
      }),
    });
    return await this.readOne(id);
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  async list(
    input: ProjectMemberListInput,
  ): Promise<PaginatedListType<UnsecuredDto<ProjectMember>>> {
    const conditions: SQL[] = [isNull(projectMembers.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }
    conditions.push(...projectMemberFilterClauses(this.db, input.filter));

    const sortColumns = {
      createdAt: projectMembers.createdAt,
      modifiedAt: projectMembers.updatedAt,
    } satisfies SortMap<keyof ProjectMember>;

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, projectMembers.createdAt),
      page: input.page,
      count: input.count,
    });
    if (rows.length === 0) return { total, items: [], hasMore };

    // Two-phase: paged IDs → readMany picks up project + user relations.
    const items = await this.readMany(rows.map((r) => r.id));
    // Preserve the ordering produced by paginatedSelect.
    const byId = new Map(items.map((i) => [i.id, i]));
    return {
      total,
      items: rows.map((r) => byId.get(r.id)!).filter(Boolean),
      hasMore,
    };
  }

  /**
   * Resolve memberships keyed by `(project, user)` pairs — drives the
   * `Project.membership` resolver, which surfaces the current user's
   * membership row + roles + inactiveAt. Read permission is assumed (only
   * called for the requesting user's own row).
   */
  async readManyByProjectAndUser(
    input: readonly MembershipByProjectAndUserInput[],
  ): Promise<Array<UnsecuredDto<ProjectMember>>> {
    if (input.length === 0) return [];
    const pairs = input.map(
      (i) =>
        and(
          eq(projectMembers.projectId, i.project),
          eq(projectMembers.userId, i.user),
        )!,
    );
    const rows = await this.db.query.projectMembers.findMany({
      where: (m) =>
        and(
          isNull(m.deletedAt),
          // OR of the (project, user) pairs.
          sql`(${sql.join(pairs, sql` OR `)})`,
        ),
      with: {
        project: { columns: { id: true, type: true, sensitivity: true } },
        user: { with: { globalRoles: true } },
      },
    });
    return (rows as ProjectMemberRow[]).map((row) => this.toDto(row));
  }

  /**
   * Project-scoped notification recipients — active members on `project`,
   * optionally filtered by `roles`. Returns minimal user + email pairs (skips
   * the full hydrate). Used by notifier hooks.
   */
  async listAsNotifiers(
    projectId: ID<'Project'>,
    roles?: readonly Role[],
  ): Promise<Array<{ id: ID; email: string | null }>> {
    const conditions: SQL[] = [
      eq(projectMembers.projectId, projectId),
      isNull(projectMembers.inactiveAt),
      isNull(projectMembers.deletedAt),
    ];
    if (roles?.length) {
      const rolesLit = sql.raw(
        `array[${roles.map((r) => `'${r}'`).join(', ')}]::"role"[]`,
      );
      conditions.push(sql`${projectMembers.roles} && ${rolesLit}`);
    }
    return await this.db
      .select({ id: users.id, email: users.email })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(and(...conditions, isNull(users.deletedAt)));
  }

  /**
   * Auto-add `user` to `project` with `role` only if no one currently holds
   * that role on the project. If the user already has any active membership
   * we union the role onto their existing row; otherwise we create a new row.
   * Mirrors the Neo4j upsertMember + filter-by-no-existing-role flow.
   */
  async addDefaultForRole(
    role: Role,
    projectId: ID<'Project'>,
    userId: ID<'User'>,
  ): Promise<void> {
    const roleLit = sql.raw(`array['${role}']::"role"[]`);
    // Cheap guard: bail if any active member already holds the role.
    const existing = await this.db
      .select({ n: sql<number>`1` })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          isNull(projectMembers.inactiveAt),
          isNull(projectMembers.deletedAt),
          sql`${projectMembers.roles} && ${roleLit}`,
        ),
      )
      .limit(1);
    if (existing.length > 0) return;

    await this.upsertMemberRole(projectId, userId, role);
  }

  /**
   * Bulk-replace director-style memberships when a user leaves a role. Finds
   * every active project where `oldDirector` holds `role` (optionally scoped
   * to `region`), removes the role (or marks the membership inactive if it
   * was the only role), and adds `newDirector` with that role. Used by
   * field-region director changes.
   */
  async replaceMembershipsOnOpenProjects(
    oldDirector: ID<'User'>,
    newDirector: ID<'User'>,
    role: Role,
    region?: ID<'FieldRegion'>,
  ): Promise<{ projects: readonly ID[]; timestampId: DateTime }> {
    const now = DateTime.now();
    const roleLit = sql.raw(`array['${role}']::"role"[]`);

    // Affected projects: old director is an active member with `role`, project
    // is in an open status (InDevelopment | Active), optionally on `region`.
    const conditions: SQL[] = [
      eq(projectMembers.userId, oldDirector),
      isNull(projectMembers.inactiveAt),
      isNull(projectMembers.deletedAt),
      sql`${projectMembers.roles} && ${roleLit}`,
      inArray(projects.status, ['InDevelopment', 'Active']),
      isNull(projects.deletedAt),
    ];
    if (region) conditions.push(eq(projects.fieldRegionId, region));

    const targets = await this.db
      .select({
        memberId: projectMembers.id,
        projectId: projectMembers.projectId,
        roles: projectMembers.roles,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(and(...conditions));

    const affectedProjects: ID[] = [];
    for (const t of targets) {
      // Either remove the role (multi-role member) or mark inactive (sole role).
      if (t.roles.length > 1) {
        const remaining = t.roles.filter((r) => r !== role);
        await this.db
          .update(projectMembers)
          .set({ roles: remaining, updatedAt: now.toJSDate() })
          .where(eq(projectMembers.id, t.memberId));
      } else {
        await this.db
          .update(projectMembers)
          .set({ inactiveAt: now.toJSDate(), updatedAt: now.toJSDate() })
          .where(eq(projectMembers.id, t.memberId));
      }
      await this.upsertMemberRole(t.projectId, newDirector, role);
      affectedProjects.push(t.projectId);
    }
    return { projects: affectedProjects, timestampId: now };
  }

  /**
   * Add `role` to the active membership of `(projectId, userId)`; create the
   * row if it doesn't exist. Re-activates a soft-inactive row in the same
   * project + user pair. Used by addDefaultForRole and the role-replacement
   * flow.
   */
  private async upsertMemberRole(
    projectId: ID<'Project'>,
    userId: ID<'User'>,
    role: Role,
  ): Promise<void> {
    const existing = await this.db
      .select({ id: projectMembers.id, roles: projectMembers.roles })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
          isNull(projectMembers.deletedAt),
        ),
      )
      .limit(1);
    const row = existing[0];
    if (row) {
      const next = row.roles.includes(role) ? row.roles : [...row.roles, role];
      await this.db
        .update(projectMembers)
        .set({
          roles: next,
          inactiveAt: null,
          updatedAt: new Date(),
        })
        .where(eq(projectMembers.id, row.id));
      return;
    }
    const id = await generateId<ID<'ProjectMember'>>();
    await this.db.insert(projectMembers).values({
      id,
      projectId,
      userId,
      roles: [role],
    });
  }

  private async verifyRelationshipEligibility(
    projectId: ID,
    userId: ID,
  ): Promise<void> {
    const [project, user, existing] = await Promise.all([
      this.db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
        .limit(1),
      this.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1),
      this.db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, userId),
            isNull(projectMembers.deletedAt),
          ),
        )
        .limit(1),
    ]);
    if (!project[0]) {
      throw new NotFoundException('Could not find project', 'project');
    }
    if (!user[0]) {
      throw new NotFoundException('Could not find person', 'user');
    }
    if (existing[0]) {
      throw new DuplicateException(
        'user',
        'Person is already a member of this project',
      );
    }
  }

  protected toDto(row: ProjectMemberRow): UnsecuredDto<ProjectMember> {
    if (!row.project) {
      // Schema FK is NOT NULL → can't happen, but the relational findMany
      // makes it nullable in the type. Loud failure beats silent NaN.
      throw new ServerException(
        `ProjectMember ${row.id} has no parent project row — FK invariant violated`,
      );
    }
    return {
      id: row.id,
      __typename: 'ProjectMember',
      createdAt: DateTime.fromJSDate(row.createdAt),
      modifiedAt: DateTime.fromJSDate(row.updatedAt),
      project: { id: row.project.id, type: row.project.type },
      user: this.userRepo.mapRowToDto(row.user),
      roles: [...row.roles],
      sensitivity: row.project.sensitivity,
      inactiveAt: row.inactiveAt ? DateTime.fromJSDate(row.inactiveAt) : null,
    };
  }
}

/**
 * Build the column-level WHERE clauses for a `ProjectMemberFilters` input
 * against `project_members`. Reusable from sub-filters in other domains
 * (Project's `members`/`membership` sub-filter calls this, completing the
 * circular dep between project and project_member filters).
 */
export const projectMemberFilterClauses = (
  db: DrizzleDb,
  filter: ProjectMemberFilters | undefined,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;
  if (filter.roles?.length) {
    const rolesLit = sql.raw(
      `array[${filter.roles.map((r) => `'${r}'`).join(', ')}]::"role"[]`,
    );
    conditions.push(sql`${projectMembers.roles} && ${rolesLit}`);
  }
  if (filter.active === true) {
    conditions.push(isNull(projectMembers.inactiveAt));
  } else if (filter.active === false) {
    conditions.push(isNotNull(projectMembers.inactiveAt));
  }
  if (filter.user) {
    const sub = db
      .selectDistinct({ id: users.id })
      .from(users)
      .where(
        and(isNull(users.deletedAt), ...userFilterClauses(db, filter.user)),
      );
    conditions.push(inArray(projectMembers.userId, sub));
  }
  if (filter.project) {
    // Mirror of projectFilterClauses' `members`/`membership` sub-filter:
    // restrict to memberships whose parent project matches `filter.project`.
    // The circular import (project.drizzle.repository ↔ this file) is benign
    // because each export is a function reference resolved at call time.
    const sub = db
      .selectDistinct({ id: projects.id })
      .from(projects)
      .where(
        and(
          isNull(projects.deletedAt),
          ...projectFilterClauses(db, filter.project),
        ),
      );
    conditions.push(inArray(projectMembers.projectId, sub));
  }
  return conditions;
};
