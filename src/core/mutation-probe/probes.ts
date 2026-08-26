import { sql } from 'drizzle-orm';
import { type ID } from '~/common';
import {
  engagements,
  languages,
  organizations,
  partners,
  partnerships,
  periodicReports,
  products,
  projectMembers,
  projects,
  users,
} from '~/core/drizzle/schema';
import { type Cohort, type Probe, type ProbeContext } from './probe';

/**
 * The migrated rows each probe draws from.
 *
 * Two things shape this list. Types are stratified, so every project type,
 * engagement type and product type gets looked at rather than whichever
 * happened to sort first — ids are random strings, so an unstratified sample of
 * five would miss an Internship engagement about two times in five, and would
 * never once see an Other product (69 rows out of 80,320).
 *
 * And projects are split by whether the acting project manager is on the team,
 * because that is what their permission to edit turns on. Membership rows came
 * across in the migration, so this asks a question about migrated DATA, not
 * just about policy.
 */
export const cohorts = (actor: ID): Readonly<Record<string, Cohort>> => {
  const onTheTeam = sql`exists (
    select 1 from ${projectMembers} pm
    where pm.project_id = ${projects.id}
      and pm.user_id = ${actor}
      and pm.deleted_at is null
  )`;
  return {
    users: { table: users, id: users.id, deletedAt: users.deletedAt },
    organizations: {
      table: organizations,
      id: organizations.id,
      deletedAt: organizations.deletedAt,
    },
    partners: {
      table: partners,
      id: partners.id,
      deletedAt: partners.deletedAt,
    },
    languages: {
      table: languages,
      id: languages.id,
      deletedAt: languages.deletedAt,
    },
    projectsMember: {
      table: projects,
      id: projects.id,
      deletedAt: projects.deletedAt,
      predicate: onTheTeam,
      stratifyBy: projects.type,
    },
    projectsNotMember: {
      table: projects,
      id: projects.id,
      deletedAt: projects.deletedAt,
      predicate: sql`not ${onTheTeam}`,
      stratifyBy: projects.type,
    },
    partnerships: {
      table: partnerships,
      id: partnerships.id,
      deletedAt: partnerships.deletedAt,
    },
    engagements: {
      table: engagements,
      id: engagements.id,
      deletedAt: engagements.deletedAt,
      stratifyBy: engagements.type,
    },
    products: {
      table: products,
      id: products.id,
      deletedAt: products.deletedAt,
      stratifyBy: products.type,
    },
    // No deleted_at by design — periodic_reports is real-delete.
    periodicReports: {
      table: periodicReports,
      id: periodicReports.id,
      stratifyBy: periodicReports.type,
    },
    projectMembersOnMyProjects: {
      table: projectMembers,
      id: projectMembers.id,
      deletedAt: projectMembers.deletedAt,
      predicate: sql`exists (
        select 1 from ${projectMembers} mine
        where mine.project_id = ${projectMembers.projectId}
          and mine.user_id = ${actor}
          and mine.deleted_at is null
      )`,
    },
  };
};

/** Distinct per run and per row, so a read-back cannot pass on a stale value. */
const mark = (id: ID) => `probe ${id} ${process.pid}`;

interface Secured<T> {
  readonly value: T | null;
}
interface Reads {
  readonly user: { readonly about: Secured<string> };
  readonly organization: { readonly address: Secured<string> };
  readonly partner: { readonly address: Secured<string> };
  readonly language: { readonly displayNamePronunciation: Secured<string> };
  readonly project: { readonly name: Secured<string> };
}
type Read<K extends keyof Reads> = Pick<Reads, K>;

interface PartnerSensitivityRead {
  readonly partner: {
    readonly id: string;
    readonly sensitivity: string;
    readonly projects: {
      readonly items: ReadonlyArray<{
        readonly id: string;
        readonly sensitivity: string;
      }>;
    };
  };
}
interface ProjectListRead {
  readonly projects: {
    readonly items: ReadonlyArray<{
      readonly id: string;
      readonly sensitivity: string;
    }>;
  };
}
interface TeamRead {
  readonly project: { readonly team: { readonly total: number } };
}

/**
 * Write one field, read it back, and insist the new value is there.
 *
 * The read-back is the whole point. "The mutation did not throw" is satisfied
 * by a repository that accepts an update and silently does nothing, which is a
 * defect this codebase has actually shipped.
 */
const writeAndReadBack = async <T>(
  ctx: ProbeContext,
  id: ID,
  opts: {
    readonly mutation: string;
    readonly variables: (value: string) => Record<string, unknown>;
    readonly query: string;
    readonly actual: (data: T) => unknown;
  },
): Promise<void> => {
  const value = mark(id);
  await ctx.gql(opts.mutation, opts.variables(value));
  const after = await ctx.gql<T>(opts.query, { id });
  const actual = opts.actual(after);
  if (actual !== value) {
    throw new Error(
      `wrote ${JSON.stringify(value)} but read back ${JSON.stringify(actual)}`,
    );
  }
};

/**
 * Insist the call is REFUSED on permissions.
 *
 * Succeeding is the failure here. So is failing for any other reason: an
 * unexpected crash would otherwise read as "correctly denied" and hide a real
 * defect behind a check that looks satisfied.
 */
const expectDenied = async (
  ctx: ProbeContext,
  what: string,
  call: () => Promise<unknown>,
): Promise<void> => {
  try {
    await call();
  } catch (err: unknown) {
    if (ctx.isDenied(err)) return;
    throw new Error(
      `expected a refusal for ${what} but it failed for another reason: ` +
        (err instanceof Error ? err.message : String(err)),
    );
  }
  throw new Error(`${what} was ALLOWED — expected the policy to refuse it`);
};

/** A live user who is not already on this project's team, if there is one. */
const someoneNotOnTheTeam = async (
  ctx: ProbeContext,
  project: ID,
): Promise<ID | undefined> => {
  const rows = await ctx.db
    .select({ id: users.id })
    .from(users)
    .where(
      // Never the actor. On the "projects they do NOT manage" cohort the actor
      // is by definition not on the team, so without this they can come back as
      // the newcomer — and adding yourself is a different question with a
      // different answer (see the create-permission spec in test/).
      sql`${users.deletedAt} is null and ${users.id} <> ${ctx.actor} and not exists (
        select 1 from ${projectMembers} pm
        where pm.project_id = ${project}
          and pm.user_id = ${users.id}
          and pm.deleted_at is null
      )`,
    )
    .orderBy(users.id)
    .limit(1);
  return rows[0]?.id as ID | undefined;
};

/** After a delete, reading it back must not return it. */
const expectGone = async (
  ctx: ProbeContext,
  what: string,
  id: ID,
  query: string,
): Promise<void> => {
  try {
    await ctx.gql(query, { id });
  } catch {
    return; // NotFound is the expected shape.
  }
  throw new Error(`deleted the ${what} but it is still readable`);
};

const UPDATE_PROJECT = `mutation ProbeUpdateProject($input: UpdateProject!) {
  updateProject(input: $input) { project { id } }
}`;
const READ_PROJECT = `query ProbeReadProject($id: ID!) {
  project(id: $id) { id name { value } }
}`;
const ADD_MEMBER = `mutation ProbeAddMember($input: CreateProjectMember!) {
  createProjectMember(input: $input) { projectMember { id } }
}`;

export const probes: readonly Probe[] = [
  // ---- As a project manager, split by whether they are on the team --------
  {
    /**
     * The grant reads `r.Project.read.create.when(member).edit` — edit applies
     * only to a project they are a member of. Those membership rows came across
     * in the migration, so this is really asking whether migrated team data
     * still grants what it should.
     */
    key: 'PM edits a project they manage',
    domain: 'projectsMember',
    run: async (ctx, id) =>
      await writeAndReadBack<Read<'project'>>(ctx, id, {
        mutation: UPDATE_PROJECT,
        variables: (name) => ({ input: { id, name } }),
        query: READ_PROJECT,
        actual: (d) => d.project.name.value,
      }),
  },
  {
    key: 'PM cannot edit a project they do not manage',
    domain: 'projectsNotMember',
    run: async (ctx, id) =>
      await expectDenied(
        ctx,
        'editing a non-member project',
        async () =>
          await ctx.gql(UPDATE_PROJECT, { input: { id, name: mark(id) } }),
      ),
  },
  {
    key: 'PM adds a member to a project they manage',
    domain: 'projectsMember',
    run: async (ctx, id) => {
      // Somebody who is NOT already on this team. It cannot be the actor: this
      // cohort is defined as projects they are a member of, so adding them
      // fails with "already a member" every single time.
      const newcomer = await someoneNotOnTheTeam(ctx, id);
      if (!newcomer) {
        return { notApplicable: 'every live user is already on this team' };
      }
      const team = `query ProbeTeam($id: ID!) {
        project(id: $id) { team(input: { count: 1 }) { total } }
      }`;
      const before = await ctx.gql<TeamRead>(team, { id });
      await ctx.gql(ADD_MEMBER, { input: { project: id, user: newcomer } });
      const after = await ctx.gql<TeamRead>(team, { id });
      const expected = before.project.team.total + 1;
      if (after.project.team.total !== expected) {
        throw new Error(
          `team total went ${before.project.team.total} -> ` +
            `${after.project.team.total}, expected ${expected}`,
        );
      }
      return undefined;
    },
  },
  {
    /**
     * Adding SOMEBODY ELSE, deliberately — not the actor.
     *
     * An earlier version of this probe added the actor to themselves and came
     * back allowed every time, which read like a permission bug. It is not a
     * migration one. `ProjectMemberService.create` writes the membership row
     * before it checks the permission, and checks the row it just wrote, so
     * adding yourself satisfies the membership requirement in the act of being
     * checked. Both databases do it — measured, four checks each, identical.
     * See `test/project-member-create-permission.e2e-spec.ts`, which holds the
     * evidence and the failing test that will announce the fix.
     *
     * With the actor's own id out of the way, this asks the question the probe
     * is here to ask: do the MIGRATED membership rows still refuse someone who
     * is not on the team?
     */
    key: 'PM cannot add a member to a project they do not manage',
    domain: 'projectsNotMember',
    run: async (ctx, id) => {
      const newcomer = await someoneNotOnTheTeam(ctx, id);
      if (!newcomer) {
        return { notApplicable: 'every live user is already on this team' };
      }
      await expectDenied(
        ctx,
        'adding a member to a non-member project',
        async () =>
          await ctx.gql(ADD_MEMBER, {
            input: { project: id, user: newcomer },
          }),
      );
      return undefined;
    },
  },

  // ---- As an administrator, where no project-membership rule applies ------
  {
    key: 'updateUser',
    domain: 'users',
    as: 'admin',
    run: async (ctx, id) =>
      await writeAndReadBack<Read<'user'>>(ctx, id, {
        mutation: `mutation ProbeUpdateUser($input: UpdateUser!) {
          updateUser(input: $input) { user { id } }
        }`,
        variables: (about) => ({ input: { id, about } }),
        query: `query ProbeReadUser($id: ID!) {
          user(id: $id) { id about { value } }
        }`,
        actual: (d) => d.user.about.value,
      }),
  },
  {
    key: 'updateOrganization',
    domain: 'organizations',
    as: 'admin',
    run: async (ctx, id) =>
      await writeAndReadBack<Read<'organization'>>(ctx, id, {
        mutation: `mutation ProbeUpdateOrg($input: UpdateOrganization!) {
          updateOrganization(input: $input) { organization { id } }
        }`,
        variables: (address) => ({ input: { id, address } }),
        query: `query ProbeReadOrg($id: ID!) {
          organization(id: $id) { id address { value } }
        }`,
        actual: (d) => d.organization.address.value,
      }),
  },
  {
    key: 'updatePartner',
    domain: 'partners',
    as: 'admin',
    run: async (ctx, id) =>
      await writeAndReadBack<Read<'partner'>>(ctx, id, {
        mutation: `mutation ProbeUpdatePartner($input: UpdatePartner!) {
          updatePartner(input: $input) { partner { id } }
        }`,
        variables: (address) => ({ input: { id, address } }),
        query: `query ProbeReadPartner($id: ID!) {
          partner(id: $id) { id address { value } }
        }`,
        actual: (d) => d.partner.address.value,
      }),
  },
  {
    key: 'updateLanguage',
    domain: 'languages',
    as: 'admin',
    run: async (ctx, id) =>
      await writeAndReadBack<Read<'language'>>(ctx, id, {
        mutation: `mutation ProbeUpdateLanguage($input: UpdateLanguage!) {
          updateLanguage(input: $input) { language { id } }
        }`,
        variables: (displayNamePronunciation) => ({
          input: { id, displayNamePronunciation },
        }),
        query: `query ProbeReadLanguage($id: ID!) {
          language(id: $id) { id displayNamePronunciation { value } }
        }`,
        actual: (d) => d.language.displayNamePronunciation.value,
      }),
  },
  {
    /**
     * The one that has caught a real bug.
     *
     * A partner's sensitivity is documented as "Based on the project's
     * sensitivity" — the lowest among the projects it partners with. On
     * Postgres it was a stored column that nothing maintained, and the reason
     * that survived every check is worth restating: the loader wrote correct
     * values, so reading agreed perfectly, and it only went wrong once
     * something happened that should have MOVED it.
     *
     * So this moves it. A weaker version — write an unrelated field, confirm
     * sensitivity did not change — passes on the broken implementation too,
     * because on migrated data the stored value is already right.
     */
    key: 'partner sensitivity follows a new project',
    domain: 'partners',
    as: 'admin',
    run: async (ctx, id) => {
      const rank: Record<string, number> = { Low: 1, Medium: 2, High: 3 };
      const read = `query ProbePartnerSensitivity($id: ID!) {
        partner(id: $id) {
          id
          sensitivity
          projects(input: { count: 50 }) { items { id sensitivity } }
        }
      }`;
      const before = await ctx.gql<PartnerSensitivityRead>(read, { id });
      const current = before.partner.sensitivity;
      if ((rank[current] ?? 9) <= rank.Low!) {
        return {
          notApplicable: `partner is already ${current}, nothing lower to move to`,
        };
      }
      const linked = new Set(before.partner.projects.items.map((p) => p.id));
      const { projects: found } = await ctx.gql<ProjectListRead>(
        `query ProbeFindLowerProject {
          projects(input: { count: 50, filter: { sensitivity: [Low] } }) {
            items { id sensitivity }
          }
        }`,
      );
      const candidate = found.items.find(
        (p) =>
          !linked.has(p.id) &&
          (rank[p.sensitivity] ?? 9) < (rank[current] ?? 9),
      );
      if (!candidate) {
        return {
          notApplicable: `no unlinked project with sensitivity below ${current}`,
        };
      }
      await ctx.gql(
        `mutation ProbeLinkPartner($input: CreatePartnership!) {
          createPartnership(input: $input) { partnership { id } }
        }`,
        { input: { partner: id, project: candidate.id } },
      );
      const after = await ctx.gql<PartnerSensitivityRead>(read, { id });
      if (after.partner.sensitivity !== candidate.sensitivity) {
        throw new Error(
          `linked a ${candidate.sensitivity} project (${candidate.id}) but ` +
            `sensitivity is still ${after.partner.sensitivity} ` +
            `(was ${current}) — it is not derived from the projects`,
        );
      }
      return undefined;
    },
  },

  // ---- Deletion, last: it removes the rows the checks above read ---------
  {
    key: 'PM removes a member from a project they manage',
    domain: 'projectMembersOnMyProjects',
    run: async (ctx, id) => {
      await ctx.gql(
        `mutation ProbeDeleteMember($id: ID!) {
          deleteProjectMember(id: $id) { __typename }
        }`,
        { id },
      );
    },
  },
  {
    key: 'delete a migrated partnership',
    domain: 'partnerships',
    as: 'admin',
    run: async (ctx, id) => {
      await ctx.gql(
        `mutation ProbeDeletePartnership($id: ID!) {
          deletePartnership(id: $id) { __typename }
        }`,
        { id },
      );
      await expectGone(
        ctx,
        'partnership',
        id,
        `query ProbeGonePartnership($id: ID!) { partnership(id: $id) { id } }`,
      );
    },
  },
  {
    key: 'delete a migrated engagement',
    domain: 'engagements',
    as: 'admin',
    run: async (ctx, id) => {
      await ctx.gql(
        `mutation ProbeDeleteEngagement($id: ID!) {
          deleteEngagement(id: $id) { __typename }
        }`,
        { id },
      );
      await expectGone(
        ctx,
        'engagement',
        id,
        `query ProbeGoneEngagement($id: ID!) { engagement(id: $id) { id } }`,
      );
    },
  },
  {
    /**
     * The biggest cascade there is, and where the two databases genuinely
     * differ: the old one cuts children loose rather than deleting them, which
     * is why 1,082 files are sitting unreachable today. Postgres cascades
     * instead. Worth watching on real trees.
     */
    key: 'delete a migrated project',
    domain: 'projectsMember',
    as: 'admin',
    run: async (ctx, id) => {
      await ctx.gql(
        `mutation ProbeDeleteProject($id: ID!) {
          deleteProject(id: $id) { __typename }
        }`,
        { id },
      );
      await expectGone(ctx, 'project', id, READ_PROJECT);
    },
  },
];
