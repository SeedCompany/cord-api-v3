import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { CalendarDate, type ID, Role } from '~/common';
import { graphql } from '~/graphql';
import { ProgressReportStatus as Status } from '../src/components/progress-report/dto';
import { Transitions } from '../src/components/progress-report/workflow/transitions';
import {
  createLanguage,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  fragments,
  registerUser,
  runAsAdmin,
  type TestApp,
  type TestUser,
} from './utility';

// Pins the fix for PRW-1: the Drizzle progress-report workflow repo used to
// skip the read grant Neo4j applies, so a role with execute-only access (no
// `.read`) got back every event instead of none. Nothing exercised this end
// to end, which is exactly why the leak survived three landed PRs.
describe('ProgressReport Workflow e2e', () => {
  let app: TestApp;
  let projectManager: TestUser;
  let fieldPartner: TestUser;
  let language: fragments.language;
  let reportId: ID<'ProgressReport'>;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);

    projectManager = await registerUser(app, {
      roles: [Role.ProjectManager],
    });
    fieldPartner = await registerUser(app, {
      roles: [Role.FieldPartner],
    });

    language = await runAsAdmin(app, createLanguage);
  });

  beforeEach(async () => {
    await projectManager.login();
    const project = await createProject(app, {
      mouStart: CalendarDate.local(2023, 1, 1).toISO(),
      mouEnd: CalendarDate.local(2024, 1, 1).toISO(),
    });
    await createProjectMember(app, {
      user: fieldPartner.id,
      project: project.id,
      roles: [Role.FieldPartner],
    });
    reportId = await createProgressReport(app, project.id, language.id);
  });

  it('a role with execute-only access cannot read back the events it recorded', async () => {
    await projectManager.login();
    await executeTransition(app, reportId, Transitions.Start.id);

    await fieldPartner.login();
    await executeTransition(
      app,
      reportId,
      Transitions['In Progress -> In Review'].id,
    );

    await projectManager.login();
    const asManager = await workflowEvents(app, reportId);
    expect(asManager.map((event) => event.status)).toEqual([
      Status.InProgress,
      Status.InReview,
    ]);

    await fieldPartner.login();
    const asFieldPartner = await workflowEvents(app, reportId);
    expect(asFieldPartner).toEqual([]);
  });

  it("a departed author's event disappears without breaking the rest of the list", async () => {
    await projectManager.login();
    await executeTransition(app, reportId, Transitions.Start.id);

    await fieldPartner.login();
    await executeTransition(
      app,
      reportId,
      Transitions['In Progress -> In Review'].id,
    );

    // Switch off fieldPartner's session before deleting them — runAsAdmin
    // restores whatever session was ambient going in, and that would replay a
    // now-dead token on the very next request.
    await projectManager.login();
    await runAsAdmin(app, () => deleteUser(app, fieldPartner.id));

    const remaining = await workflowEvents(app, reportId);
    expect(remaining.map((event) => event.transition?.id)).toEqual([
      Transitions.Start.id,
    ]);
  });
});

async function createProgressReport(app: TestApp, project: ID, language: ID) {
  const { createEng } = await app.graphql.mutate(
    graphql(
      `
        mutation CreateLanguageEngagementForWorkflowTest(
          $input: CreateLanguageEngagement!
        ) {
          createEng: createLanguageEngagement(input: $input) {
            engagement {
              ...languageEngagement
              progressReports(input: { count: 1 }) {
                items {
                  id
                }
              }
            }
          }
        }
      `,
      [fragments.languageEngagement],
    ),
    { input: { project, language } },
  );
  return createEng.engagement.progressReports.items[0]!.id;
}

async function executeTransition(app: TestApp, report: ID, transition: ID) {
  await app.graphql.mutate(
    graphql(`
      mutation TransitionProgressReportForWorkflowTest(
        $input: ExecuteProgressReportTransition!
      ) {
        transitionProgressReport(input: $input) {
          id
        }
      }
    `),
    { input: { report, transition } },
  );
}

async function workflowEvents(app: TestApp, id: ID) {
  const { report } = await app.graphql.query(
    graphql(`
      query ProgressReportWorkflowEventsForTest($id: ID!) {
        report: periodicReport(id: $id) {
          __typename
          ... on ProgressReport {
            workflowEvents {
              id
              status
              transition {
                id
                label
              }
            }
          }
        }
      }
    `),
    { id },
  );
  if (report.__typename !== 'ProgressReport') throw new Error();
  return report.workflowEvents;
}

async function deleteUser(app: TestApp, id: ID) {
  await app.graphql.mutate(
    graphql(`
      mutation DeleteUserForWorkflowTest($id: ID!) {
        deleteUser(id: $id) {
          __typename
        }
      }
    `),
    { id },
  );
}
