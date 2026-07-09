import { beforeAll, describe, expect, it } from '@jest/globals';
import { CalendarDate, type ID, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createLanguage,
  createLanguageEngagement,
  createPartnership,
  createProject,
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
      async () =>
        await app.graphql.query(ProjectsDoc, { input: { count: 100 } }),
    );
    expect(admin.projects.items.map((p) => p.id)).toContain(projectId);

    const seen = await outsider.runAs(
      async () =>
        await app.graphql.query(ProjectsDoc, { input: { count: 100 } }),
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
          await app.graphql.query(EngagementsDoc, { input: { count: 100 } }),
      );
      expect(admin.engagements.items.map((e) => e.id)).toContain(engagementId);

      const seen = await outsider.runAs(
        async () =>
          await app.graphql.query(EngagementsDoc, { input: { count: 100 } }),
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
        await app.graphql.query(PartnershipsDoc, { input: { count: 100 } }),
    );
    expect(admin.partnerships.items.map((p) => p.id)).toContain(partnershipId);

    const seen = await outsider.runAs(
      async () =>
        await app.graphql.query(PartnershipsDoc, { input: { count: 100 } }),
    );
    expect(seen.partnerships.items.map((p) => p.id)).not.toContain(
      partnershipId,
    );
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
