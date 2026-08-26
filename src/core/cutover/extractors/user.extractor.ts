import { type ID, type Role } from '~/common';
import { ConfigService } from '~/core/config';
import {
  authIdentities,
  educations,
  systemAgents,
  unavailabilities,
  userGlobalRoles,
  users,
} from '~/core/drizzle/schema';
import { type User } from '../../../components/user/dto';
import { type Education } from '../../../components/user/education/dto';
import { EducationRepository } from '../../../components/user/education/education.repository';
import { type Unavailability } from '../../../components/user/unavailability/dto';
import { UnavailabilityRepository } from '../../../components/user/unavailability/unavailability.repository';
import { UserRepository } from '../../../components/user/user.repository';
import {
  bulkInsert,
  cypher,
  linkId,
  liveTargetIds,
  orDefault,
  readAllViaRepo,
  stat,
  tsReq,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * User cluster — users + user_global_roles + educations + unavailabilities +
 * system_agents + auth_identities (password hashes). Inserts users first (the
 * rest FK to it).
 *
 * Deliberately NOT migrated (transient): auth_sessions, auth_password_reset_tokens
 * — users re-authenticate post-cutover (see README + the User-domain spec).
 */
export const userExtractor: Extractor = {
  name: 'user',
  targetTables: [
    'users',
    'user_global_roles',
    'educations',
    'unavailabilities',
    'system_agents',
    'auth_identities',
  ],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    // ── users ──────────────────────────────────────────────────────────────
    const userDtos = await readAllViaRepo<User>(ctx, 'User', UserRepository);
    // Root must be flagged here: with is_root=false everywhere, the admin
    // bootstrap's createRootUser conflicts with the migrated row and
    // waitForRootUserId polls forever (first PG boot on an ETL'd DB hangs —
    // shadow-diff maiden-run finding, ledger S5).
    //
    // The authoritative marker in Neo4j is the `:RootUser` LABEL (admin.repository
    // sets it and reads it back), not the configured email — this box's ROOT_USER
    // need not match the source graph's. The email is kept only as a fallback for
    // a graph where the label was never applied.
    const rootEmail = ctx.moduleRef.get(ConfigService, { strict: false })
      .rootUser.email;
    const labelledRoots = new Set(
      (
        await cypher<{ id: ID }>(ctx, `MATCH (n:RootUser) RETURN n.id AS id`)
      ).map((row) => row.id),
    );
    const isRootUser = (u: { id: ID; email?: string | null }) =>
      labelledRoots.size > 0 ? labelledRoots.has(u.id) : u.email === rootEmail;
    const userRows = userDtos.map((u) => ({
      id: u.id,
      isRoot: isRootUser(u),
      // NOT NULL columns whose Property node may be missing in Neo4j — coalesce
      // to the schema default (real load surfaced null `status` on legacy rows).
      status: orDefault(ctx, 'users.status', u.status, 'Active'),
      email: u.email ?? null,
      realFirstName: orDefault(
        ctx,
        'users.real_first_name',
        u.realFirstName,
        '',
      ),
      realLastName: orDefault(ctx, 'users.real_last_name', u.realLastName, ''),
      displayFirstName: orDefault(
        ctx,
        'users.display_first_name',
        u.displayFirstName,
        '',
      ),
      displayLastName: orDefault(
        ctx,
        'users.display_last_name',
        u.displayLastName,
        '',
      ),
      phone: u.phone ?? null,
      timezone: orDefault(ctx, 'users.timezone', u.timezone, 'America/Chicago'),
      about: u.about ?? null,
      title: u.title ?? null,
      gender: u.gender ?? null,
      // Plain text (no FK); the referenced file_node lands in the file wave.
      photoId: linkId(u.photo),
      createdAt: tsReq(u.createdAt),
      updatedAt: tsReq(u.createdAt),
      deletedAt: null,
    }));
    // Assert the outcome rather than assuming it. Landing ZERO root users is the
    // exact S5 failure this flag exists to prevent — the first Postgres boot on
    // the loaded DB then tries to create a root user, conflicts with the migrated
    // row on its primary key, and `waitForRootUserId` polls forever. Landing more
    // than one is equally wrong and would be invisible. Neither shows up in any
    // row count, so the run has to say it out loud.
    const rootCount = userRows.filter((row) => row.isRoot).length;
    if (rootCount !== 1) {
      ctx.log(
        `    ⚠⚠ ${rootCount} user(s) flagged is_root — expected exactly 1. ` +
          (rootCount === 0
            ? `Neither a :RootUser label nor a user with the configured ROOT_USER email ` +
              `(${rootEmail}) was found in the source. The first Postgres boot on this ` +
              `database will HANG in waitForRootUserId (ledger S5).`
            : `More than one root will make the bootstrap's root lookup ambiguous.`),
      );
    }
    out.users = stat(userDtos.length, await bulkInsert(ctx, users, userRows));

    // Every table below FKs to users.id, and the three built from raw Cypher
    // below enumerate ALL `:User` nodes — a superset of what actually LANDED.
    // readMany silently drops nodes with broken required rels (49 locally), and
    // onConflictDoNothing can drop more, so an unfiltered child insert dies on
    // `*_user_id_fkey`. This is the truth source; skips are counted, not silent.
    const landedUsers = await liveTargetIds(ctx, 'User', users);
    let orphanedChildren = 0;
    const userLanded = (userId: ID): boolean => {
      if (landedUsers.has(userId)) return true;
      orphanedChildren++;
      return false;
    };

    // ── user_global_roles ───────────────────────────────────────────────────
    const roleRows = userDtos.flatMap((u) =>
      (u.roles ?? []).map((role) => ({ userId: u.id, role })),
    );
    out.user_global_roles = stat(
      roleRows.length,
      await bulkInsert(ctx, userGlobalRoles, roleRows),
    );

    // ── educations (userId via the User→Education rel) ───────────────────────
    // migration-todo: verify the rel name/direction against a live Neo4j — a
    // mismatch silently drops rows (orphans skipped). Spec: (User)-[:education]->(Education).
    const eduDtos = await readAllViaRepo<Education>(
      ctx,
      'Education',
      EducationRepository,
    );
    const eduPairs = await cypher<{ eid: ID; uid: ID }>(
      ctx,
      `MATCH (u:User)-[:education { active: true }]->(e:Education)
       RETURN e.id AS eid, u.id AS uid`,
    );
    const eduUser = new Map(eduPairs.map((p) => [p.eid, p.uid]));
    const eduRows = eduDtos.flatMap((e) => {
      const userId = eduUser.get(e.id);
      return userId && userLanded(userId)
        ? [
            {
              id: e.id,
              userId,
              degree: e.degree,
              major: e.major,
              institution: e.institution,
              createdAt: tsReq(e.createdAt),
              updatedAt: tsReq(e.createdAt),
              deletedAt: null,
            },
          ]
        : [];
    });
    // `read` is the PRE-guard count, so a dropped row shows up as a read-vs-
    // inserted gap. Counting `eduRows.length` here would make the guard's own
    // drops invisible — read would equal inserted and the table would tick ✓.
    const eduOrphans = eduDtos.filter((e) => !eduUser.get(e.id)).length;
    const eduUnlanded = eduDtos.length - eduRows.length - eduOrphans;
    if (eduOrphans > 0) {
      ctx.log(
        `    ⚠ DROPPED ${eduOrphans} education(s) with no active [:education] edge from any live user ` +
          `(the owning user is soft-deleted, or the edge was deactivated)`,
      );
    }
    if (eduUnlanded > 0) {
      ctx.log(
        `    ⚠ DROPPED ${eduUnlanded} education(s) whose user never landed in Postgres`,
      );
    }
    out.educations = stat(
      eduDtos.length,
      await bulkInsert(ctx, educations, eduRows),
    );

    // ── unavailabilities ─────────────────────────────────────────────────────
    const unavailDtos = await readAllViaRepo<Unavailability>(
      ctx,
      'Unavailability',
      UnavailabilityRepository,
    );
    const unavailPairs = await cypher<{ xid: ID; uid: ID }>(
      ctx,
      `MATCH (u:User)-[:unavailability { active: true }]->(x:Unavailability)
       RETURN x.id AS xid, u.id AS uid`,
    );
    const unavailUser = new Map(unavailPairs.map((p) => [p.xid, p.uid]));
    const unavailRows = unavailDtos.flatMap((x) => {
      const userId = unavailUser.get(x.id);
      return userId && userLanded(userId)
        ? [
            {
              id: x.id,
              userId,
              description: x.description,
              start: tsReq(x.start),
              end: tsReq(x.end),
              createdAt: tsReq(x.createdAt),
              updatedAt: tsReq(x.createdAt),
              deletedAt: null,
            },
          ]
        : [];
    });
    const unavailOrphans = unavailDtos.filter(
      (x) => !unavailUser.get(x.id),
    ).length;
    const unavailUnlanded =
      unavailDtos.length - unavailRows.length - unavailOrphans;
    if (unavailOrphans > 0) {
      ctx.log(
        `    ⚠ DROPPED ${unavailOrphans} unavailability(s) with no active [:unavailability] edge from ` +
          `any live user (the owning user is soft-deleted, or the edge was deactivated)`,
      );
    }
    if (unavailUnlanded > 0) {
      ctx.log(
        `    ⚠ DROPPED ${unavailUnlanded} unavailability(s) whose user never landed in Postgres`,
      );
    }
    out.unavailabilities = stat(
      unavailDtos.length,
      await bulkInsert(ctx, unavailabilities, unavailRows),
    );

    // ── system_agents (roles stored directly on the node; createdAt defaulted) ─
    const agentRows = await cypher<{ id: ID; name: string; roles: string[] }>(
      ctx,
      `MATCH (n:SystemAgent) RETURN n.id AS id, n.name AS name, n.roles AS roles`,
    );
    out.system_agents = stat(
      agentRows.length,
      await bulkInsert(
        ctx,
        systemAgents,
        agentRows.map((a) => ({
          id: a.id,
          name: a.name,
          roles: (a.roles ?? []) as Role[],
        })),
      ),
    );

    // ── auth_identities (password hashes — copied as-is; updatedAt defaulted) ──
    const pwRows = await cypher<{ userId: ID; hash: string }>(
      ctx,
      `MATCH (u:User)-[:password { active: true }]->(p:Property)
       RETURN u.id AS userId, p.value AS hash`,
    );
    const pwLanded = pwRows.filter((p) => userLanded(p.userId));
    out.auth_identities = stat(
      pwRows.length,
      await bulkInsert(
        ctx,
        authIdentities,
        pwLanded.map((p) => ({ userId: p.userId, passwordHash: p.hash })),
      ),
    );

    if (orphanedChildren > 0) {
      ctx.log(
        `    ⚠ skipped ${orphanedChildren} education/unavailability/auth-identity row(s) whose user never ` +
          `landed in \`users\` (hydrate-drop or conflict-drop). Each skipped auth_identity is a user who ` +
          `CANNOT log in post-cutover — reconcile the users hydrate-drop list before the real load.`,
      );
    }

    return out;
  },
};
