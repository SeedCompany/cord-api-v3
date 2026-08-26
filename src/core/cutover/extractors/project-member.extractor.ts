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
 *
 * ## One person can be a member of one project TWICE
 *
 * Neo4j puts no uniqueness on `(project, user)` and the service never checks, so
 * production carries 8 pairs where the same user holds two live memberships of
 * the same project — some created minutes apart (a double submit), some years
 * apart (re-added by someone who did not know). None are inactive; both are
 * fully live.
 *
 * Postgres models this differently: roles are an ARRAY on a single membership
 * row, under a partial unique index on `(project_id, user_id) WHERE deleted_at
 * IS NULL`. So the second row cannot exist, and until 2026-08-20 it was silently
 * refused by `onConflictDoNothing` — keeping whichever row reached Postgres
 * first, which is arbitrary.
 *
 * That is not a duplicate being tidied away, it is **a permission being
 * revoked**. `matchProjectScopedRoles` (match-project-based-props.ts) matches
 * EVERY membership node for the user on that project and `collect`s the roles
 * across all of them, so Neo4j grants the UNION. Three of the eight differ:
 * `FinancialAnalyst` vs none, `ProjectManager` vs none, and
 * `BibleTranslationLiaison` vs `ConsultantManager`. Dropping the wrong row of
 * those pairs removes access the person has today.
 *
 * So duplicates are MERGED rather than dropped: union of roles, earliest
 * `createdAt`, latest `updatedAt`, and still active if any membership is. That
 * reproduces exactly what Neo4j grants, and the merged row keeps the earliest
 * membership's id so a rerun picks the same one.
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
        [...orDefault(ctx, 'project_members.roles', m.roles, [])],
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

    // Merge duplicate (project, user) memberships — see the docblock. Ordered by
    // createdAt so the surviving id and the merged dates do not depend on the
    // order readMany happened to return.
    const byPair = new Map<string, Array<(typeof rows)[number]>>();
    for (const row of rows) {
      const key = `${row.projectId}\u0000${row.userId}`;
      const held = byPair.get(key);
      if (held) held.push(row);
      else byPair.set(key, [row]);
    }
    const mergedPairs: string[] = [];
    const roleChanges: string[] = [];
    const merged = [...byPair.values()].map((group) => {
      if (group.length === 1) return group[0]!;
      const ordered = [...group].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      const keep = ordered[0]!;
      const roles = [...new Set(ordered.flatMap((row) => row.roles))].sort(
        (a, b) => a.localeCompare(b),
      );
      // Only worth a line when the merge actually changes someone's access —
      // identical roles on both memberships is a true duplicate and boring.
      if (ordered.some((row) => row.roles.length !== roles.length)) {
        roleChanges.push(
          `${keep.projectId}/${keep.userId} → ${roles.join('+')}`,
        );
      }
      mergedPairs.push(keep.id);
      return {
        ...keep,
        roles,
        // Live if ANY membership is live; Neo4j reads them together.
        inactiveAt: ordered.some((row) => row.inactiveAt == null)
          ? null
          : ordered[ordered.length - 1]!.inactiveAt,
        updatedAt: ordered.reduce(
          (latest, row) => (row.updatedAt > latest ? row.updatedAt : latest),
          ordered[0]!.updatedAt,
        ),
      };
    });
    if (mergedPairs.length > 0) {
      ctx.log(
        `    ℹ merged ${rows.length - merged.length} duplicate project ` +
          `membership(s) into ${mergedPairs.length} row(s) — the same user held ` +
          `more than one live membership of the same project, which Postgres's ` +
          `partial unique index cannot represent. Roles are UNIONED because ` +
          `Neo4j grants the union; dropping a row would revoke access.` +
          (roleChanges.length > 0
            ? ` ${roleChanges.length} of them changed someone's role set: ${roleChanges.join(', ')}`
            : ''),
      );
    }

    return one(
      'project_members',
      dtos.length,
      await bulkInsert(ctx, projectMembers, merged),
    );
  },
};
