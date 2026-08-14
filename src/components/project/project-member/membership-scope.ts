import { and, eq, inArray, isNull } from 'drizzle-orm';
import { type ID, type Role } from '~/common';
import { type DrizzleDb } from '~/core/drizzle/drizzle.service';
import {
  partners,
  partnerships,
  projectMembers,
  projects,
} from '~/core/drizzle/schema';
import {
  rolesForScope,
  type ScopedRole,
} from '../../authorization/dto/role.dto';

/**
 * The requesting user's scoped roles per project — `member` policy conditions
 * read these off each DTO's `scope` property (mirror of Neo4j's
 * matchProjectScopedRoles): the `'member:true'` marker plus the membership
 * roles project-scoped. Every project-scoped domain's drizzle repo attaches
 * this in its read paths.
 */
export const requesterScopeByProject = async (
  db: DrizzleDb,
  userId: ID<'User'>,
  projectIds: ReadonlyArray<ID<'Project'>>,
): Promise<Map<ID<'Project'>, ScopedRole[]>> => {
  if (projectIds.length === 0) {
    return new Map();
  }
  const memberships = await db
    .select({
      projectId: projectMembers.projectId,
      roles: projectMembers.roles,
    })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        inArray(projectMembers.projectId, [...new Set(projectIds)]),
        isNull(projectMembers.inactiveAt),
        isNull(projectMembers.deletedAt),
      ),
    );
  return new Map(
    memberships.map((m) => [
      m.projectId,
      ['member:true' as const, ...m.roles.map(rolesForScope('project'))],
    ]),
  );
};

/** Folds `(key, roles)` rows into one scope entry per key, de-duped. */
const groupIntoScopeMap = <K extends ID>(
  rows: ReadonlyArray<{ key: K; roles: readonly Role[] }>,
): Map<K, ScopedRole[]> => {
  const rolesByKey = new Map<K, Set<Role>>();
  for (const row of rows) {
    const roles = rolesByKey.get(row.key) ?? new Set<Role>();
    row.roles.forEach((role) => roles.add(role));
    rolesByKey.set(row.key, roles);
  }
  return new Map(
    [...rolesByKey].map(([key, roles]) => [
      key,
      ['member:true' as const, ...[...roles].map(rolesForScope('project'))],
    ]),
  );
};

/**
 * The requesting user's scoped roles across every project a Partner touches
 * via a live Partnership — a Partner isn't itself project-scoped, so
 * `requesterScopeByProject` doesn't apply. Mirrors Neo4j's Partner hydrate
 * (unions scoped roles over every project reachable through a live
 * partnership) and the `member` policy condition's bespoke Partner SQL in
 * `member.condition.ts` — keep the join/liveness shape in lockstep with that.
 */
export const requesterScopeByPartner = async (
  db: DrizzleDb,
  userId: ID<'User'>,
  partnerIds: ReadonlyArray<ID<'Partner'>>,
): Promise<Map<ID<'Partner'>, ScopedRole[]>> => {
  if (partnerIds.length === 0) return new Map();
  const rows = await db
    .select({ key: partnerships.partnerId, roles: projectMembers.roles })
    .from(partnerships)
    .innerJoin(
      projects,
      and(eq(projects.id, partnerships.projectId), isNull(projects.deletedAt)),
    )
    .innerJoin(
      projectMembers,
      and(
        eq(projectMembers.projectId, partnerships.projectId),
        eq(projectMembers.userId, userId),
        isNull(projectMembers.inactiveAt),
        isNull(projectMembers.deletedAt),
      ),
    )
    .where(
      and(
        inArray(partnerships.partnerId, [...new Set(partnerIds)]),
        isNull(partnerships.deletedAt),
      ),
    );
  return groupIntoScopeMap(rows);
};

/**
 * Same as {@link requesterScopeByPartner}, one hop further out: the
 * Organization's own Partners, each's Partnerships, each's live Project.
 * Mirrors the `member` condition's Organization SQL in `member.condition.ts`.
 */
export const requesterScopeByOrganization = async (
  db: DrizzleDb,
  userId: ID<'User'>,
  organizationIds: ReadonlyArray<ID<'Organization'>>,
): Promise<Map<ID<'Organization'>, ScopedRole[]>> => {
  if (organizationIds.length === 0) return new Map();
  const rows = await db
    .select({ key: partners.organizationId, roles: projectMembers.roles })
    .from(partners)
    .innerJoin(
      partnerships,
      and(
        eq(partnerships.partnerId, partners.id),
        isNull(partnerships.deletedAt),
      ),
    )
    .innerJoin(
      projects,
      and(eq(projects.id, partnerships.projectId), isNull(projects.deletedAt)),
    )
    .innerJoin(
      projectMembers,
      and(
        eq(projectMembers.projectId, partnerships.projectId),
        eq(projectMembers.userId, userId),
        isNull(projectMembers.inactiveAt),
        isNull(projectMembers.deletedAt),
      ),
    )
    .where(
      and(
        inArray(partners.organizationId, [...new Set(organizationIds)]),
        isNull(partners.deletedAt),
      ),
    );
  return groupIntoScopeMap(rows);
};
