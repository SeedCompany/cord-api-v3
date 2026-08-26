import { type ID } from '~/common';
import {
  engagements,
  languages,
  organizations,
  partners,
  partnerships,
  periodicReports,
  projects,
  users,
} from '~/core/drizzle/schema';
import { type Probe, type SampledTable } from './probe';

/**
 * The migrated rows each probe draws from. Live rows only, in id order, so a
 * failure can be quoted and reproduced.
 */
export const sampledTables: Readonly<Record<string, SampledTable>> = {
  users: { table: users, id: users.id, deletedAt: users.deletedAt },
  organizations: {
    table: organizations,
    id: organizations.id,
    deletedAt: organizations.deletedAt,
  },
  partners: { table: partners, id: partners.id, deletedAt: partners.deletedAt },
  languages: {
    table: languages,
    id: languages.id,
    deletedAt: languages.deletedAt,
  },
  projects: { table: projects, id: projects.id, deletedAt: projects.deletedAt },
  partnerships: {
    table: partnerships,
    id: partnerships.id,
    deletedAt: partnerships.deletedAt,
  },
  engagements: {
    table: engagements,
    id: engagements.id,
    deletedAt: engagements.deletedAt,
  },
  // No deleted_at by design — periodic_reports is real-delete.
  periodicReports: { table: periodicReports, id: periodicReports.id },
};

/** Distinct per run and per row, so a read-back cannot pass on a stale value. */
const mark = (id: ID) => `probe ${id} ${process.pid}`;

/** The shape every access-controlled scalar comes back in. */
interface Secured<T> {
  readonly value: T | null;
}
interface Reads {
  readonly user: { readonly about: Secured<string> };
  readonly organization: { readonly address: Secured<string> };
  readonly partner: { readonly address: Secured<string> };
  readonly language: { readonly displayNamePronunciation: Secured<string> };
  readonly project: { readonly name: Secured<string> };
  readonly partnership: { readonly mouStartOverride: Secured<string> };
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
  ctx: Parameters<Probe['run']>[0],
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

export const probes: readonly Probe[] = [
  {
    key: 'updateUser',
    domain: 'users',
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
    /**
     * The F2 shape, turned into a check that can actually see it.
     *
     * A partner's sensitivity is documented as "Based on the project's
     * sensitivity" — the lowest among the projects it partners with. On
     * Postgres it was a stored column that nothing maintained, and the reason
     * that survived every check we had is worth restating: the ETL loaded
     * correct values, so reading agreed perfectly, and the value only went
     * wrong once something happened that should have moved it.
     *
     * So this probe MOVES it. Link the partner to a project whose sensitivity
     * is lower than the partner's current one, and the partner must follow. A
     * stored column will not, and a derived one will.
     *
     * Note what a weaker version of this misses: writing an unrelated field and
     * checking sensitivity "did not change" passes on the broken implementation
     * too, because on migrated data the loaded value is already right.
     */
    key: 'partner sensitivity follows a new project',
    domain: 'partners',
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
      const current: string = before.partner.sensitivity;
      if ((rank[current] ?? 9) <= rank.Low!) {
        return {
          notApplicable: `partner is already ${current}, nothing lower to move to`,
        };
      }

      // A project this partner is NOT already linked to, with a lower
      // sensitivity than the partner currently reports.
      const linked = new Set<string>(
        before.partner.projects.items.map((p: { id: string }) => p.id),
      );
      const { projects } = await ctx.gql<ProjectListRead>(
        `query ProbeFindLowerProject {
          projects(input: { count: 50, filter: { sensitivity: [Low] } }) {
            items { id sensitivity }
          }
        }`,
      );
      const candidate = projects.items.find(
        (p: { id: string; sensitivity: string }) =>
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
  {
    key: 'updateLanguage',
    domain: 'languages',
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
    key: 'updateProject',
    domain: 'projects',
    run: async (ctx, id) =>
      await writeAndReadBack<Read<'project'>>(ctx, id, {
        mutation: `mutation ProbeUpdateProject($input: UpdateProject!) {
          updateProject(input: $input) { project { id } }
        }`,
        variables: (name) => ({ input: { id, name } }),
        query: `query ProbeReadProject($id: ID!) {
          project(id: $id) { id name { value } }
        }`,
        actual: (d) => d.project.name.value,
      }),
  },
  {
    // Creating a CHILD of a migrated parent, which is a different risk from
    // editing the parent: the new row has to satisfy constraints and required
    // links against a parent the application never wrote.
    key: 'createProjectMember on a migrated project',
    domain: 'projects',
    run: async (ctx, id) => {
      const { project } = await ctx.gql<TeamRead>(
        `query ProbeTeam($id: ID!) {
          project(id: $id) { id team(input: { count: 1 }) { total } }
        }`,
        { id },
      );
      const before = project.team.total;
      await ctx.gql(
        `mutation ProbeAddMember($input: CreateProjectMember!) {
          createProjectMember(input: $input) { projectMember { id } }
        }`,
        // No roles: a member may only be given roles the user already holds
        // globally (project-member.service.ts:199), and this probe is asking
        // whether a member can attach to a MIGRATED project at all, not what
        // they may be called once attached.
        { input: { project: id, user: ctx.actor } },
      );
      const { project: after } = await ctx.gql<TeamRead>(
        `query ProbeTeamAfter($id: ID!) {
          project(id: $id) { id team(input: { count: 1 }) { total } }
        }`,
        { id },
      );
      if (after.team.total !== before + 1) {
        throw new Error(
          `team total went ${before} -> ${after.team.total}, expected ${
            before + 1
          }`,
        );
      }
    },
  },
  {
    key: 'updatePartnership',
    domain: 'partnerships',
    run: async (ctx, id) => {
      // A date rather than a string: partnerships carry no free-text field, and
      // the override columns are the ones a user actually edits.
      const value = '2024-03-04';
      await ctx.gql(
        `mutation ProbeUpdatePartnership($input: UpdatePartnership!) {
          updatePartnership(input: $input) { partnership { id } }
        }`,
        { input: { id, mouStartOverride: value } },
      );
      const after = await ctx.gql<Read<'partnership'>>(
        `query ProbeReadPartnership($id: ID!) {
          partnership(id: $id) { id mouStartOverride { value } }
        }`,
        { id },
      );
      const actual = after.partnership.mouStartOverride.value;
      if (actual !== value) {
        throw new Error(`wrote ${value} but read back ${String(actual)}`);
      }
    },
  },
];
