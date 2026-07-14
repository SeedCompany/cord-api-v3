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
    const rootEmail = ctx.moduleRef.get(ConfigService, { strict: false })
      .rootUser.email;
    const userRows = userDtos.map((u) => ({
      id: u.id,
      isRoot: u.email === rootEmail,
      // NOT NULL columns whose Property node may be missing in Neo4j — coalesce
      // to the schema default (real load surfaced null `status` on legacy rows).
      status: orDefault(u.status, 'Active'),
      email: u.email ?? null,
      realFirstName: orDefault(u.realFirstName, ''),
      realLastName: orDefault(u.realLastName, ''),
      displayFirstName: orDefault(u.displayFirstName, ''),
      displayLastName: orDefault(u.displayLastName, ''),
      phone: u.phone ?? null,
      timezone: orDefault(u.timezone, 'America/Chicago'),
      about: u.about ?? null,
      title: u.title ?? null,
      gender: u.gender ?? null,
      // Plain text (no FK); the referenced file_node lands in the file wave.
      photoId: linkId(u.photo),
      createdAt: tsReq(u.createdAt),
      updatedAt: tsReq(u.createdAt),
      deletedAt: null,
    }));
    out.users = stat(userDtos.length, await bulkInsert(ctx, users, userRows));

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
      return userId
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
    out.educations = stat(
      eduRows.length,
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
      return userId
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
    out.unavailabilities = stat(
      unavailRows.length,
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
    out.auth_identities = stat(
      pwRows.length,
      await bulkInsert(
        ctx,
        authIdentities,
        pwRows.map((p) => ({ userId: p.userId, passwordHash: p.hash })),
      ),
    );

    return out;
  },
};
