import { eq, sql } from 'drizzle-orm';
import { type PgTable } from 'drizzle-orm/pg-core';
import { type ID } from '~/common';
import {
  ceremonies,
  engagements,
  fileNodes,
  languages,
  media,
  notifications,
  organizations,
  partners,
  partnerships,
  periodicReports,
  productProgress,
  products,
  projectMembers,
  projects,
  resourceMutations,
  userGlobalRoles,
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

    // ---- B2 (2026-08-28): the giant tables nothing had written to ----------
    // Everything probed before this totals ~22K rows; these six tables hold
    // 3.7M. Media has no deleted_at; product_progress and step_progress are
    // real-cascade.
    files: {
      table: fileNodes,
      id: fileNodes.id,
      deletedAt: fileNodes.deletedAt,
      // FileVersions are immutable records of an upload — rename targets the
      // File/Directory nodes. A File without a latest version is a
      // DefinedFile placeholder that never got an upload; hydration drops
      // those DELIBERATELY on both engines (715,685 of 1.07M live Files!),
      // so probing one reads as NotFound and proves nothing. The
      // loader-flagged '(unnamed)' rows get their own cohort below so they
      // cannot lose the draw to ordinary ones.
      predicate: sql`(${fileNodes.type} = 'Directory'
        or (${fileNodes.type} = 'File' and ${fileNodes.latestVersionId} is not null))
        and ${fileNodes.name} <> '(unnamed)'`,
      stratifyBy: fileNodes.type,
    },
    // Stratified by variant: 337,709 official rows would otherwise bury the
    // 7,178 partner-variant ones, which carry their own permission arm.
    productProgress: {
      table: productProgress,
      id: productProgress.id,
      stratifyBy: productProgress.variant,
    },
    // Only media attached to a ProgressReportMedia row: the metadata-update
    // poll has exactly one voter (the progress-report handler) and denies
    // everything else FAIL-CLOSED on both engines, so probing an unattached
    // medium reads as denied and proves nothing. 8,619 of 75,269 qualify.
    media: {
      table: media,
      id: media.id,
      predicate: sql`exists (
        select 1 from file_nodes fv
        join file_nodes f on f.id = fv.parent_id
        join progress_report_media prm
          on prm.file_id = f.id and prm.deleted_at is null
        where fv.id = ${media.fileVersionId}
      )`,
    },

    // ---- The rows the loader flagged as odd — shapes the app never writes --
    // The app now READS blanks and merges it never wrote; these cohorts write
    // THROUGH those exact rows instead of the first N ordinary ones.
    filesUnnamed: {
      table: fileNodes,
      id: fileNodes.id,
      deletedAt: fileNodes.deletedAt,
      // 2,410 files whose name Property never existed in Neo4j; the loader
      // filled '(unnamed)'. 2,289 of them are ALSO version-less placeholders
      // — unreadable by design on both engines (see the files cohort) and
      // part of the parked stranded-rows decision — so this targets the 121
      // that carry a real version and are actually reachable.
      predicate: sql`${fileNodes.name} = '(unnamed)'
        and ${fileNodes.latestVersionId} is not null`,
    },
    ceremoniesBlankPlanned: {
      table: ceremonies,
      id: ceremonies.id,
      deletedAt: ceremonies.deletedAt,
      // 7,386 kept-blank rows — the class migration 0042 made representable.
      predicate: sql`${ceremonies.planned} is null`,
    },
    membersUnionedRoles: {
      table: projectMembers,
      id: projectMembers.id,
      deletedAt: projectMembers.deletedAt,
      // 1,357 memberships whose roles the loader unioned from duplicate
      // Neo4j membership nodes (proxy: more than one role on the row).
      predicate: sql`array_length(${projectMembers.roles}, 1) > 1`,
    },
    usersUnionedRoles: {
      table: users,
      id: users.id,
      deletedAt: users.deletedAt,
      // 231 users holding more than one global role — the merged-user shape.
      predicate: sql`(
        select count(*) from ${userGlobalRoles} gr
        where gr.user_id = ${users.id}
      ) > 1`,
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
interface ProductCompletionRead {
  readonly product: {
    readonly describeCompletion: { readonly value: string | null };
  };
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

  // ---- B2: the giants — 3.7M rows across six tables, first writes ever ----
  {
    key: 'renameFileNode on a migrated node',
    domain: 'files',
    as: 'admin',
    run: async (ctx, id) =>
      await writeAndReadBack<{ fileNode: { name: string } }>(ctx, id, {
        mutation: `mutation ProbeRename($input: RenameFile!) {
          renameFileNode(input: $input) { id }
        }`,
        variables: (name) => ({ input: { id, name } }),
        query: `query ProbeReadNode($id: ID!) {
          fileNode(id: $id) { id name }
        }`,
        actual: (d) => d.fileNode.name,
      }),
  },
  {
    key: 'updatePeriodicReport receivedDate',
    domain: 'periodicReports',
    as: 'admin',
    run: async (ctx, id) => {
      const read = `query ProbeReadReport($id: ID!) {
        periodicReport(id: $id) { id receivedDate { value } }
      }`;
      interface ReportRead {
        readonly periodicReport: {
          readonly receivedDate: { readonly value: string | null };
        };
      }
      const before = await ctx.gql<ReportRead>(read, { id });
      const target =
        before.periodicReport.receivedDate.value === '2001-02-03'
          ? '2001-02-04'
          : '2001-02-03';
      await ctx.gql(
        `mutation ProbeUpdateReport($input: UpdatePeriodicReport!) {
          updatePeriodicReport(input: $input) { id }
        }`,
        { input: { id, receivedDate: target } },
      );
      const after = await ctx.gql<ReportRead>(read, { id });
      if (after.periodicReport.receivedDate.value !== target) {
        throw new Error(
          `wrote receivedDate ${target} but read back ` +
            `${JSON.stringify(after.periodicReport.receivedDate.value)}`,
        );
      }
    },
  },
  {
    /**
     * One probe covers the three concrete product types — the cohort is
     * stratified by type, so the 69 OtherProducts are drawn alongside the
     * 80,000 scripture ones, and each goes through its own update mutation.
     */
    key: 'update a migrated product (by concrete type)',
    domain: 'products',
    as: 'admin',
    run: async (ctx, id) => {
      const typed = await ctx.gql<{ product: { __typename: string } }>(
        `query ProbeProductType($id: ID!) { product(id: $id) { __typename id } }`,
        { id },
      );
      const typename = typed.product.__typename;
      const mutation: Record<string, string> = {
        DirectScriptureProduct: 'updateDirectScriptureProduct',
        DerivativeScriptureProduct: 'updateDerivativeScriptureProduct',
        OtherProduct: 'updateOtherProduct',
      };
      const name = mutation[typename];
      if (!name) {
        return { notApplicable: `unhandled product type ${typename}` };
      }
      await writeAndReadBack<ProductCompletionRead>(ctx, id, {
        mutation: `mutation ProbeUpdateProduct($input: Update${typename}!) {
          ${name}(input: $input) { product { id } }
        }`,
        variables: (describeCompletion) => ({
          input: { id, describeCompletion },
        }),
        query: `query ProbeReadProduct($id: ID!) {
          product(id: $id) { id describeCompletion { value } }
        }`,
        actual: (d) => d.product.describeCompletion.value,
      });
      return undefined;
    },
  },
  {
    /**
     * Writes step_progress THROUGH the API — the two largest tables nothing
     * had ever written to (product_progress 345K, step_progress 1.48M).
     *
     * The step written must be one the product plans TODAY: a migrated step
     * row can carry a step that is no longer in the product's plan, and the
     * service rejects those (StepNotPlannedException) — so the step comes
     * from the product, not from the migrated row.
     */
    key: 'updateProductProgress writes migrated step rows',
    domain: 'productProgress',
    as: 'admin',
    run: async (ctx, id) => {
      const [row] = await ctx.db
        .select({
          productId: productProgress.productId,
          reportId: productProgress.reportId,
          variant: productProgress.variant,
        })
        .from(productProgress)
        .where(eq(productProgress.id, id));
      if (!row) throw new Error('cohort row vanished before the probe ran');

      const prod = await ctx.gql<{
        product: {
          steps: { value: readonly string[] };
          progressTarget: { value: number | null };
        };
      }>(
        `query ProbeProgressProduct($id: ID!) {
          product(id: $id) { id steps { value } progressTarget { value } }
        }`,
        { id: row.productId },
      );
      const step = prod.product.steps.value[0];
      if (!step) return { notApplicable: 'product plans no steps' };
      const target = prod.product.progressTarget.value ?? 1;
      if (target < 1) {
        return { notApplicable: 'progressTarget below 1 — no value to write' };
      }

      // The variant must be passed: `progress` defaults to the official
      // variant, so a partner-variant write would read back undefined here
      // while having landed fine (which is exactly what the first run did).
      const readBack = `query ProbeProgressRead($id: ID!, $variant: ID) {
        periodicReport(id: $id) {
          ... on ProgressReport {
            progress(variant: $variant) {
              variant { key }
              product { id }
              steps { step completed { value } }
            }
          }
        }
      }`;
      interface ProgressRead {
        readonly periodicReport: {
          readonly progress?: ReadonlyArray<{
            readonly variant: { readonly key: string };
            readonly product: { readonly id: string };
            readonly steps: ReadonlyArray<{
              readonly step: string;
              readonly completed: { readonly value: number | null };
            }>;
          }>;
        };
      }
      const completedOf = (data: ProgressRead) =>
        data.periodicReport.progress
          ?.find(
            (p) =>
              p.product.id === row.productId && p.variant.key === row.variant,
          )
          ?.steps.find((s) => s.step === step)?.completed.value;

      const before = await ctx.gql<ProgressRead>(readBack, {
        id: row.reportId,
        variant: row.variant,
      });
      const next = completedOf(before) === 1 ? 0 : 1;
      await ctx.gql(
        `mutation ProbeUpdateProgress($input: UpdateProductProgress!) {
          updateProductProgress(input: $input) { product { id } }
        }`,
        {
          input: {
            product: row.productId,
            report: row.reportId,
            variant: row.variant,
            steps: [{ step, completed: next }],
          },
        },
      );
      const after = completedOf(
        await ctx.gql<ProgressRead>(readBack, {
          id: row.reportId,
          variant: row.variant,
        }),
      );
      if (after !== next) {
        throw new Error(
          `wrote completed=${next} for ${step} but read back ` +
            JSON.stringify(after),
        );
      }
      return undefined;
    },
  },
  {
    /**
     * The e2e exemption for this mutation says "needs an uploaded image" —
     * true for a FRESH medium, but the whole point of this probe is that
     * 75,269 migrated media rows already exist. No top-level media query
     * exists, so persistence is confirmed at the table; the WRITE still runs
     * the full resolver → service → repository stack.
     */
    key: 'updateMediaMetadata on a migrated medium',
    domain: 'media',
    as: 'admin',
    run: async (ctx, id) => {
      const value = mark(id);
      await ctx.gql(
        `mutation ProbeMedia($id: ID!, $metadata: MediaUserMetadata!) {
          updateMediaMetadata(id: $id, metadata: $metadata) { __typename }
        }`,
        { id, metadata: { altText: value } },
      );
      const [after] = await ctx.db
        .select({ altText: media.altText })
        .from(media)
        .where(eq(media.id, id));
      if (after?.altText !== value) {
        throw new Error(
          `wrote altText ${JSON.stringify(value)} but the row holds ` +
            JSON.stringify(after?.altText ?? null),
        );
      }
    },
  },

  // ---- B2: the rows the loader flagged as odd -----------------------------
  {
    key: 'renames an "(unnamed)" file the loader flagged',
    domain: 'filesUnnamed',
    as: 'admin',
    run: async (ctx, id) =>
      await writeAndReadBack<{ fileNode: { name: string } }>(ctx, id, {
        mutation: `mutation ProbeRenameUnnamed($input: RenameFile!) {
          renameFileNode(input: $input) { id }
        }`,
        variables: (name) => ({ input: { id, name } }),
        query: `query ProbeReadUnnamed($id: ID!) {
          fileNode(id: $id) { id name }
        }`,
        actual: (d) => d.fileNode.name,
      }),
  },
  {
    /**
     * The 0042 shape end-to-end: a ceremony whose `planned` was NULL since
     * the load — a value the app itself never wrote — gets its first write.
     * Ceremony has no top-level query, so the read-back goes through the
     * owning engagement.
     */
    key: 'updateCeremony fills a kept-blank planned',
    domain: 'ceremoniesBlankPlanned',
    as: 'admin',
    run: async (ctx, id) => {
      const [row] = await ctx.db
        .select({ engagementId: ceremonies.engagementId })
        .from(ceremonies)
        .where(eq(ceremonies.id, id));
      if (!row) throw new Error('cohort row vanished before the probe ran');
      await ctx.gql(
        `mutation ProbeCeremony($input: UpdateCeremony!) {
          updateCeremony(input: $input) { ceremony { id } }
        }`,
        { input: { id, planned: true } },
      );
      const after = await ctx.gql<{
        engagement: {
          ceremony: {
            value: { planned: { value: boolean | null } } | null;
          };
        };
      }>(
        `query ProbeCeremonyRead($id: ID!) {
          engagement(id: $id) {
            id
            ceremony { value { id planned { value } } }
          }
        }`,
        { id: row.engagementId },
      );
      const read = after.engagement.ceremony.value?.planned.value;
      if (read !== true) {
        throw new Error(
          `wrote planned=true over the kept blank but read back ` +
            JSON.stringify(read ?? null),
        );
      }
    },
  },
  {
    /**
     * A membership whose roles the loader unioned from duplicate Neo4j
     * membership nodes — narrow it to one role and confirm the row holds
     * exactly that. Read back at the table: ProjectMember has no top-level
     * query, and the team list read is already covered elsewhere.
     */
    key: 'updateProjectMember narrows merged roles',
    domain: 'membersUnionedRoles',
    as: 'admin',
    run: async (ctx, id) => {
      const [row] = await ctx.db
        .select({ roles: projectMembers.roles })
        .from(projectMembers)
        .where(eq(projectMembers.id, id));
      const keep = row?.roles?.[0];
      if (!keep) return { notApplicable: 'membership row carries no roles' };
      await ctx.gql(
        `mutation ProbeMemberRoles($input: UpdateProjectMember!) {
          updateProjectMember(input: $input) { projectMember { id } }
        }`,
        { input: { id, roles: [keep] } },
      );
      const [after] = await ctx.db
        .select({ roles: projectMembers.roles })
        .from(projectMembers)
        .where(eq(projectMembers.id, id));
      if (!after || after.roles.length !== 1 || after.roles[0] !== keep) {
        throw new Error(
          `narrowed roles to [${keep}] but the row holds ` +
            JSON.stringify(after?.roles ?? null),
        );
      }
      return undefined;
    },
  },
  {
    /** The merged-user shape: more than one global role on one person. */
    key: 'updateUser on a user with unioned global roles',
    domain: 'usersUnionedRoles',
    as: 'admin',
    run: async (ctx, id) =>
      await writeAndReadBack<Read<'user'>>(ctx, id, {
        mutation: `mutation ProbeUpdateMergedUser($input: UpdateUser!) {
          updateUser(input: $input) { user { id } }
        }`,
        variables: (about) => ({ input: { id, about } }),
        query: `query ProbeReadMergedUser($id: ID!) {
          user(id: $id) { id about { value } }
        }`,
        actual: (d) => d.user.about.value,
      }),
  },

  // ---- B4: side effects — the audit trail and the rollback invariant ------
  {
    /**
     * Every user-driven mutation must leave a resource_mutations row, written
     * by the audit handler INSIDE the same transaction. A silent audit gap is
     * invisible to every read comparison, so it gets its own probe.
     */
    key: 'a write on a migrated row leaves an audit entry',
    domain: 'languages',
    as: 'admin',
    run: async (ctx, id) => {
      const auditCount = async () => {
        const rows = await ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(resourceMutations)
          .where(eq(resourceMutations.resourceId, id));
        return rows[0]?.n ?? 0;
      };
      const before = await auditCount();
      // Suffixed so it differs from what the updateLanguage probe wrote to
      // the same row earlier in the run: an identical value makes
      // getActualChanges empty and the service returns before writing or
      // firing the hook — which read as a missing audit row on the first run.
      await ctx.gql(
        `mutation ProbeAuditedUpdate($input: UpdateLanguage!) {
          updateLanguage(input: $input) { language { id } }
        }`,
        { input: { id, displayNamePronunciation: `${mark(id)} audit` } },
      );
      const after = await auditCount();
      if (after !== before + 1) {
        throw new Error(
          `audit rows for the language went ${before} -> ${after}, ` +
            'expected exactly one more',
        );
      }
    },
  },
  {
    /**
     * The rolled-back-transaction invariant — the 122-email incident shape.
     *
     * createProjectMember WRITES the membership row before the permission
     * check that refuses it (the documented create-then-check ordering), so a
     * refused add is a transaction that already contained a real write when
     * it threw. Nothing may survive: not the membership row (counted across
     * ALL rows, so a write-then-soft-delete cannot fake the rollback), not a
     * notification, not an audit entry.
     */
    key: 'a refused create leaves nothing behind',
    domain: 'projectsNotMember',
    run: async (ctx, id) => {
      const newcomer = await someoneNotOnTheTeam(ctx, id);
      if (!newcomer) {
        return { notApplicable: 'every live user is already on this team' };
      }
      const memberRows = async () => {
        const rows = await ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(projectMembers)
          .where(eq(projectMembers.projectId, id));
        return rows[0]?.n ?? 0;
      };
      const tableCount = async (table: PgTable) => {
        // Annotated because a bare PgTable drops the dynamic select to `any`.
        const rows: Array<{ n: number }> = await ctx.db
          .select({ n: sql<number>`count(*)::int` })
          .from(table);
        return rows[0]?.n ?? 0;
      };
      const membersBefore = await memberRows();
      const notificationsBefore = await tableCount(notifications);
      const auditBefore = await tableCount(resourceMutations);
      await expectDenied(
        ctx,
        'adding a member to a non-member project',
        async () =>
          await ctx.gql(ADD_MEMBER, {
            input: { project: id, user: newcomer },
          }),
      );
      const leftovers: string[] = [];
      const membersAfter = await memberRows();
      if (membersAfter !== membersBefore) {
        leftovers.push(
          `membership rows went ${membersBefore} -> ${membersAfter}`,
        );
      }
      const notificationsAfter = await tableCount(notifications);
      if (notificationsAfter !== notificationsBefore) {
        leftovers.push(
          `notifications went ${notificationsBefore} -> ${notificationsAfter}`,
        );
      }
      const auditAfter = await tableCount(resourceMutations);
      if (auditAfter !== auditBefore) {
        leftovers.push(`audit rows went ${auditBefore} -> ${auditAfter}`);
      }
      if (leftovers.length > 0) {
        throw new Error(
          'the refused create left something behind: ' + leftovers.join('; '),
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
