import {
  projectMembers,
  projects,
  roleEnum,
  users,
} from '~/core/drizzle/schema';
import { type ProjectMember } from '../../../components/project/project-member/dto';
import { ProjectMemberRepository } from '../../../components/project/project-member/project-member.repository';
import {
  bulkInsert,
  linkId,
  liveTargetIds,
  one,
  orDefault,
  readAllViaRepo,
  sanitizeEnum,
  ts,
  tsReq,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * ProjectMember — the DTO's `user` is the full unsecured user, so the FK is a
 * plain `.id`. `inactiveAt` carries over as-is (member replacement history —
 * the Drizzle read filters exclude inactive members, deliberately tighter
 * than Neo4j; see the pre-cutover audit ledger).
 */
export const projectMemberExtractor: Extractor = {
  name: 'projectMember',
  targetTables: ['project_members'],
  dependsOn: ['project', 'user'],
  async run(ctx) {
    const dtos = await readAllViaRepo<ProjectMember>(
      ctx,
      'ProjectMember',
      ProjectMemberRepository,
    );

    // Prod-finding #2 guard: both FKs are NOT NULL, so rows referencing
    // soft-deleted projects/users can't be nulled — drop + log.
    const liveProjects = await liveTargetIds(ctx, 'Project', projects);
    const liveUsers = await liveTargetIds(ctx, 'User', users);
    let droppedDangling = 0;

    const droppedRoles = new Set<string>();
    const rows = dtos.flatMap((m) => {
      const projectId = linkId(m.project);
      const userId = m.user?.id;
      if (
        !projectId ||
        !liveProjects.has(projectId) ||
        !userId ||
        !liveUsers.has(userId)
      ) {
        droppedDangling++;
        return [];
      }
      // orDefault, not a bare spread — see the organization extractor: a member
      // whose roles were never written arrives undefined despite the DTO's array
      // type, and spreading it ends the whole run rather than dropping this row.
      const roles = sanitizeEnum(
        [...orDefault(m.roles, [])],
        roleEnum.enumValues,
      );
      roles.dropped.forEach((role) => droppedRoles.add(role));
      return [
        {
          id: m.id,
          projectId,
          userId,
          roles: roles.kept,
          inactiveAt: ts(m.inactiveAt),
          createdAt: tsReq(m.createdAt),
          updatedAt: tsReq(m.modifiedAt),
          deletedAt: null,
        },
      ];
    });
    if (droppedRoles.size) {
      ctx.log(
        `    ⚠ dropped unknown member role(s): ${[...droppedRoles].join(', ')} — migration-todo: map, don't drop`,
      );
    }
    if (droppedDangling) {
      ctx.log(
        `    ⚠ dropped ${droppedDangling} member(s) of soft-deleted projects/users (NOT NULL FKs — prod-finding #2)`,
      );
    }
    return one(
      'project_members',
      dtos.length,
      await bulkInsert(ctx, projectMembers, rows),
    );
  },
};
