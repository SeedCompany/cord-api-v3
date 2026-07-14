import { and, eq, inArray, isNull } from 'drizzle-orm';
import { type ID } from '~/common';
import { type DrizzleDb } from '~/core/drizzle/drizzle.service';
import { projectMembers } from '~/core/drizzle/schema';
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
