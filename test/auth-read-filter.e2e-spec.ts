import { beforeAll, describe, expect, it } from '@jest/globals';
import { CalendarDate, type ID, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createLanguage,
  createLanguageEngagement,
  createOrganization,
  createPartner,
  createPartnership,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  registerUser,
  runAsAdmin,
  type TestApp,
  type TestUser,
} from './utility';

// Read-permission leak guard. A requester with no access to a resource must not
// be able to enumerate its existence through a list endpoint. This is enforced
// in the repository layer (privileges.filterToReadable / applyReadFilter), so it
// must hold under BOTH engines — a missing filter on the postgres repo would
// silently leak rows that the neo4j repo hid.
//
// Each test pairs a NEGATIVE assertion (the restricted requester can't see the
// row) with a POSITIVE control (an admin can), so a vacuous empty list can't
// pass for the wrong reason.
//
// Lever per domain:
//  - Project, Engagement: Intern reads are `when(member)`, so a non-member
//    Intern sees none of them.
//  - Partnership: the Intern role has no Partnership read grant at all, so
//    `applyReadFilter` denies the whole list.
// (ProjectMember + Budget are only reachable nested under a Project, so they're
//  transitively covered by project-level hiding. Project/Language read is global
//  for most roles — there the auth boundary is property redaction, not row
//  hiding, which is a different test.)
// migration-todo: drop the isPostgres gate on the engagement test when the
// Language + Engagement domains recut onto develop — their fixtures can't be
// created under DATABASE=postgres until then.
const isPostgres = process.env.DATABASE === 'postgres';

// Newest-first, so a fixture created moments ago lands on page 1 even against
// a LOADED database (5,337 projects push it off the default sort's first
// page, which failed the POSITIVE controls — E2E_REUSE_DB run, 2026-08-21).
// The negative assertions get stronger with this sort, not weaker: a row the
// requester could see WOULD be on the newest-first page, so its absence
// really means hidden.
const page1Newest = { count: 100, sort: 'createdAt', order: 'DESC' } as const;

describe('Read-filter hides restricted rows from a non-privileged requester', () => {
  let app: TestApp;
  let outsider: TestUser; // Intern, not a member of the fixture project
  let projectId: ID;
  let partnershipId: ID;

  // Engagement date overrides must stay inside the project's MOU window, so
  // pin both to the same explicit dates.
  const mouStart = CalendarDate.local(2023, 1, 1).toISO();
  const mouEnd = CalendarDate.local(2024, 1, 1).toISO();

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    // The default session is an Administrator: creates the fixtures and serves
    // as the positive control (sees everything).
    await registerUser(app, { roles: [Role.Administrator] });

    const project = await createProject(app, { mouStart, mouEnd });
    projectId = project.id;

    const partnership = await createPartnership(app, { project: projectId });
    partnershipId = partnership.id;

    // A fresh Intern with no membership on the fixture project.
    outsider = await registerUser(app, { roles: [Role.Intern] });
  });

  it('hides a non-member project from the projects list', async () => {
    const admin = await runAsAdmin(
      app,
      async () => await app.graphql.query(ProjectsDoc, { input: page1Newest }),
    );
    expect(admin.projects.items.map((p) => p.id)).toContain(projectId);

    const seen = await outsider.runAs(
      async () => await app.graphql.query(ProjectsDoc, { input: page1Newest }),
    );
    expect(seen.projects.items.map((p) => p.id)).not.toContain(projectId);
  });

  // Language/Engagement fixtures can't be created under postgres yet (domains
  // not migrated on this branch) — reported as skipped there, not passed.
  // Covered under neo4j; see the migration-todo at the top of this file.
  (isPostgres ? it.skip : it)(
    'hides a non-member engagement from the engagements list',
    async () => {
      // Fixture setup must run as admin: the ambient session at this point is
      // the outsider Intern (registerUser logs the session in as the new user),
      // who can't even read the project.
      const engagementId = await runAsAdmin(app, async () => {
        const language = await createLanguage(app);
        const engagement = await createLanguageEngagement(app, {
          project: projectId,
          language: language.id,
          startDateOverride: mouStart,
          endDateOverride: mouEnd,
        });
        return engagement.id;
      });

      const admin = await runAsAdmin(
        app,
        async () =>
          await app.graphql.query(EngagementsDoc, { input: page1Newest }),
      );
      expect(admin.engagements.items.map((e) => e.id)).toContain(engagementId);

      const seen = await outsider.runAs(
        async () =>
          await app.graphql.query(EngagementsDoc, { input: page1Newest }),
      );
      expect(seen.engagements.items.map((e) => e.id)).not.toContain(
        engagementId,
      );
    },
  );

  it('hides a partnership from a requester with no Partnership read grant', async () => {
    const admin = await runAsAdmin(
      app,
      async () =>
        await app.graphql.query(PartnershipsDoc, { input: page1Newest }),
    );
    expect(admin.partnerships.items.map((p) => p.id)).toContain(partnershipId);

    const seen = await outsider.runAs(
      async () =>
        await app.graphql.query(PartnershipsDoc, { input: page1Newest }),
    );
    expect(seen.partnerships.items.map((p) => p.id)).not.toContain(
      partnershipId,
    );
  });
});

// The member condition on Partner/Organization traverses the partnership
// chain (project → partnership → partner [→ organization]), mirroring the
// Neo4j list queries' wrapContext patterns. The User member condition is
// "requester is an active member of ANY project" (Neo4j's unbound-project
// exists()). Each arm gets a negative (non-member/insufficient-sensitivity
// sees nothing) and a positive (membership flips visibility), so a vacuous
// empty list can't pass for the wrong reason.
describe('Member/sensitivity condition arms via the partnership chain', () => {
  let app: TestApp;
  let projectId: ID;
  let orgId: ID;
  let partnerId: ID;
  let fieldPartner: TestUser; // Partner+Org reads are member-gated
  let fundraising: TestUser; // Partner+Org reads are sensitivity-gated
  let intern: TestUser; // User reads are member-gated (member of ANY project)

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.Administrator] });

    const project = await createProject(app);
    projectId = project.id;
    const org = await createOrganization(app);
    orgId = org.id;
    const partner = await createPartner(app, { organization: orgId });
    partnerId = partner.id;
    await createPartnership(app, { project: projectId, partner: partnerId });

    fieldPartner = await registerUser(app, { roles: [Role.FieldPartner] });
    fundraising = await registerUser(app, { roles: [Role.Fundraising] });
    intern = await registerUser(app, { roles: [Role.Intern] });
  });

  it('hides a partner and its organization from a non-member', async () => {
    const admin = await runAsAdmin(app, async () => ({
      partners: await app.graphql.query(PartnersDoc, {
        input: page1Newest,
      }),
      orgs: await app.graphql.query(OrganizationsDoc, {
        input: page1Newest,
      }),
    }));
    expect(admin.partners.partners.items.map((p) => p.id)).toContain(partnerId);
    expect(admin.orgs.organizations.items.map((o) => o.id)).toContain(orgId);

    const seen = await fieldPartner.runAs(async () => ({
      partners: await app.graphql.query(PartnersDoc, {
        input: page1Newest,
      }),
      orgs: await app.graphql.query(OrganizationsDoc, {
        input: page1Newest,
      }),
    }));
    expect(seen.partners.partners.items.map((p) => p.id)).not.toContain(
      partnerId,
    );
    expect(seen.orgs.organizations.items.map((o) => o.id)).not.toContain(orgId);
  });

  it('hides High-sensitivity partners/orgs from a sensitivity-gated role', async () => {
    // partners.sensitivity / organizations.sensitivity are statically 'High'
    // until Language migrates and wires the real derivation, so a
    // sensMediumOrLower role sees none — fail-closed interim.
    const seen = await fundraising.runAs(async () => ({
      partners: await app.graphql.query(PartnersDoc, {
        input: page1Newest,
      }),
      orgs: await app.graphql.query(OrganizationsDoc, {
        input: page1Newest,
      }),
    }));
    expect(seen.partners.partners.items.map((p) => p.id)).not.toContain(
      partnerId,
    );
    expect(seen.orgs.organizations.items.map((o) => o.id)).not.toContain(orgId);
  });

  it('a non-member sees only themselves in the users list', async () => {
    const seen = await intern.runAs(
      async () => await app.graphql.query(UsersDoc, { input: page1Newest }),
    );
    const ids = seen.users.items.map((u) => u.id);
    expect(ids).toContain(intern.id);
    expect(ids).not.toContain(fieldPartner.id);
  });

  it('a non-member cannot resolve a project by id', async () => {
    const admin = await runAsAdmin(
      app,
      async () => await app.graphql.query(ProjectByIdDoc, { id: projectId }),
    );
    expect(admin.project.id).toBe(projectId);

    await intern.runAs(async () => {
      await expect(
        app.graphql.query(ProjectByIdDoc, { id: projectId }),
      ).rejects.toThrow();
    });
  });

  it('project membership flips partner/org/user/project visibility', async () => {
    await runAsAdmin(app, async () => {
      await createProjectMember(app, {
        project: projectId,
        user: fieldPartner.id,
        roles: [Role.FieldPartner],
      });
      await createProjectMember(app, {
        project: projectId,
        user: intern.id,
        roles: [Role.Intern],
      });
    });

    // Member arm: the partnership chain now grants partner + org.
    const seen = await fieldPartner.runAs(async () => ({
      partners: await app.graphql.query(PartnersDoc, {
        input: page1Newest,
      }),
      orgs: await app.graphql.query(OrganizationsDoc, {
        input: page1Newest,
      }),
    }));
    expect(seen.partners.partners.items.map((p) => p.id)).toContain(partnerId);
    expect(seen.orgs.organizations.items.map((o) => o.id)).toContain(orgId);

    // User arm: member of ANY project → other users become listable.
    const users = await intern.runAs(
      async () => await app.graphql.query(UsersDoc, { input: page1Newest }),
    );
    expect(users.users.items.map((u) => u.id)).toContain(fieldPartner.id);

    // Project readMany: the member can now resolve the project by id.
    const project = await intern.runAs(
      async () => await app.graphql.query(ProjectByIdDoc, { id: projectId }),
    );
    expect(project.project.id).toBe(projectId);
  });
});

const ProjectsDoc = graphql(`
  query ProjectsForReadFilter($input: ProjectListInput) {
    projects(input: $input) {
      items {
        id
      }
    }
  }
`);

const EngagementsDoc = graphql(`
  query EngagementsForReadFilter($input: EngagementListInput) {
    engagements(input: $input) {
      items {
        id
      }
    }
  }
`);

const PartnershipsDoc = graphql(`
  query PartnershipsForReadFilter($input: PartnershipListInput) {
    partnerships(input: $input) {
      items {
        id
      }
    }
  }
`);

const PartnersDoc = graphql(`
  query PartnersForReadFilter($input: PartnerListInput) {
    partners(input: $input) {
      items {
        id
      }
    }
  }
`);

const OrganizationsDoc = graphql(`
  query OrganizationsForReadFilter($input: OrganizationListInput) {
    organizations(input: $input) {
      items {
        id
      }
    }
  }
`);

const UsersDoc = graphql(`
  query UsersForReadFilter($input: UserListInput) {
    users(input: $input) {
      items {
        id
      }
    }
  }
`);

const ProjectByIdDoc = graphql(`
  query ProjectByIdForReadFilter($id: ID!) {
    project(id: $id) {
      id
    }
  }
`);
