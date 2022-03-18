import { gql } from 'apollo-server-core';
import { CalendarDate } from '../src/common';
import { Role } from '../src/components/authorization';
import { EngagementStatus } from '../src/components/engagement';
import { Language } from '../src/components/language';
import { ProjectStep } from '../src/components/project';
import {
  approveProjectChangeRequest,
  createFundingAccount,
  createLanguage,
  createLanguageEngagement,
  createLocation,
  createProject,
  createProjectChangeRequest,
  createRegion,
  createSession,
  createTestApp,
  registerUser,
  runAsAdmin,
  runInIsolatedSession,
  TestApp,
  updateProject,
} from './utility';
import { fragments } from './utility/fragments';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
} from './utility/transition-project';

const readEngagements = (app: TestApp, id: string, changeset?: string) =>
  app.graphql.query(
    gql`
      query project($id: ID!, $changeset: ID) {
        project(id: $id, changeset: $changeset) {
          ...project
          engagements {
            items {
              id
              status {
                value
              }
            }
          }
        }
      }
      ${fragments.project}
    `,
    {
      id,
      changeset,
    }
  );

const readLanguageEngagement = (app: TestApp, id: string, changeset?: string) =>
  app.graphql.query(
    gql`
      query engagement($id: ID!, $changeset: ID) {
        engagement(id: $id, changeset: $changeset) {
          ...languageEngagement
          changeset {
            id
            difference {
              added {
                id
              }
              removed {
                id
              }
              changed {
                previous {
                  id
                }
                updated {
                  id
                }
              }
            }
          }
        }
      }
      ${fragments.languageEngagement}
    `,
    {
      id,
      changeset,
    }
  );

const readProjectChangeset = (app: TestApp, id: string, changeset?: string) =>
  app.graphql.query(
    gql`
      query project($id: ID!, $changeset: ID) {
        project(id: $id, changeset: $changeset) {
          id
          changeset {
            id
            difference {
              added {
                id
              }
              removed {
                id
              }
              changed {
                previous {
                  id
                }
                updated {
                  id
                }
              }
            }
          }
        }
      }
    `,
    {
      id,
      changeset,
    }
  );

const activeProject = async (app: TestApp) => {
  const fundingAccount = await runInIsolatedSession(app, async () => {
    await registerUser(app, { roles: [Role.Administrator] }); // only admin can create funding account for now
    return await createFundingAccount(app);
  });
  const location = await runInIsolatedSession(app, async () => {
    await registerUser(app, { roles: [Role.Administrator] }); // only admin can create funding account for now
    return await createLocation(app, { fundingAccountId: fundingAccount.id });
  });
  const fieldRegion = await runInIsolatedSession(app, async () => {
    await registerUser(app, { roles: [Role.Administrator] }); // only admin can create funding account for now
    return await createRegion(app);
  });
  const project = await createProject(app);
  await updateProject(app, {
    id: project.id,
    primaryLocationId: location.id,
    fieldRegionId: fieldRegion.id,
  });
  await runAsAdmin(app, async () => {
    for (const next of [
      ...stepsFromEarlyConversationToBeforeActive,
      ProjectStep.Active,
    ]) {
      await changeProjectStep(app, project.id, next);
    }
  });

  return project;
};

describe('Engagement Changeset Aware e2e', () => {
  let app: TestApp;
  let language: Language;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);

    await registerUser(app, {
      roles: [Role.ProjectManager],
    });

    language = await runInIsolatedSession(app, async () => {
      await registerUser(app, { roles: [Role.Administrator] }); // only admin can create funding account for now
      return await createLanguage(app);
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('Create', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });

    await createLanguageEngagement(app, {
      projectId: project.id,
    });
    // Create new engagement with changeset
    const changesetEngagement = await app.graphql.mutate(
      gql`
        mutation createLanguageEngagement(
          $input: CreateLanguageEngagementInput!
        ) {
          createLanguageEngagement(input: $input) {
            engagement {
              ...languageEngagement
            }
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        input: {
          engagement: {
            languageId: language.id,
            projectId: project.id,
            status: EngagementStatus.InDevelopment,
          },
          changeset: changeset.id,
        },
      }
    );
    // list engagements without changeset
    let result = await readEngagements(app, project.id);
    expect(result.project.engagements.items.length).toBe(1);
    // list engagements with changeset
    result = await readEngagements(app, project.id, changeset.id);
    expect(result.project.engagements.items.length).toBe(2);
    expect(result.project.engagements.items[1].id).toBe(
      changesetEngagement.createLanguageEngagement.engagement.id
    );
    await approveProjectChangeRequest(app, changeset.id);
    result = await readEngagements(app, project.id);
    expect(result.project.engagements.items.length).toBe(2);
  });

  it('Update', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
      status: EngagementStatus.InDevelopment,
    });
    // Update engagement prop with changeset
    await app.graphql.mutate(
      gql`
        mutation updateLanguageEngagement(
          $input: UpdateLanguageEngagementInput!
        ) {
          updateLanguageEngagement(input: $input) {
            engagement {
              ...languageEngagement
            }
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        input: {
          engagement: {
            id: languageEngagement.id,
            completeDate: CalendarDate.fromISO('2100-08-22'),
          },
          changeset: changeset.id,
        },
      }
    );

    // read engagement without changeset
    let result = await readLanguageEngagement(app, languageEngagement.id);
    expect(result.engagement.completeDate.value !== '2100-08-22').toBeTruthy();
    // read engagement with changeset
    result = await readLanguageEngagement(
      app,
      languageEngagement.id,
      changeset.id
    );
    expect(result.engagement.completeDate.value).toBe('2100-08-22');
    await approveProjectChangeRequest(app, changeset.id);
    result = await readLanguageEngagement(app, languageEngagement.id);
    expect(result.engagement.completeDate.value).toBe('2100-08-22');
  });

  it('Update - created in changeset', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });

    // Create new engagement with changeset
    const changesetEngagement = await app.graphql.mutate(
      gql`
        mutation createLanguageEngagement(
          $input: CreateLanguageEngagementInput!
        ) {
          createLanguageEngagement(input: $input) {
            engagement {
              ...languageEngagement
            }
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        input: {
          engagement: {
            languageId: language.id,
            projectId: project.id,
            completeDate: CalendarDate.fromISO('2021-09-22'),
          },
          changeset: changeset.id,
        },
      }
    );
    expect(
      changesetEngagement.createLanguageEngagement.engagement.ceremony
    ).toBeDefined();

    const engagementId =
      changesetEngagement.createLanguageEngagement.engagement.id;

    await app.graphql.mutate(
      gql`
        mutation updateLanguageEngagement(
          $input: UpdateLanguageEngagementInput!
        ) {
          updateLanguageEngagement(input: $input) {
            engagement {
              ...languageEngagement
            }
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        input: {
          engagement: {
            id: engagementId,
            completeDate: CalendarDate.fromISO('2100-08-22'),
          },
          changeset: changeset.id,
        },
      }
    );

    // read engagement with changeset
    let result = await readLanguageEngagement(app, engagementId, changeset.id);
    expect(result.engagement.completeDate.value).toBe('2100-08-22');
    // approve changeset
    await approveProjectChangeRequest(app, changeset.id);
    result = await readLanguageEngagement(app, engagementId);
    expect(result.engagement.completeDate.value).toBe('2100-08-22');
  });

  it('Delete', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });

    await createLanguageEngagement(app, {
      projectId: project.id,
    });

    const le = await createLanguageEngagement(app, {
      projectId: project.id,
    });

    // Delete engagement in changeset
    let result = await app.graphql.mutate(
      gql`
        mutation deleteEngagement($id: ID!, $changeset: ID) {
          deleteEngagement(id: $id, changeset: $changeset) {
            __typename
          }
        }
      `,
      {
        id: le.id,
        changeset: changeset.id,
      }
    );
    const actual: boolean | undefined = result.deleteEngagement;
    expect(actual).toBeTruthy();

    // List engagements without changeset
    result = await readEngagements(app, project.id);
    expect(result.project.engagements.items.length).toBe(2);
    // List engagements with changeset
    result = await readEngagements(app, project.id, changeset.id);
    expect(result.project.engagements.items.length).toBe(1);

    // Confirm engagement id is added to removed list
    let projectChangeset = await readProjectChangeset(
      app,
      project.id,
      changeset.id
    );
    expect(projectChangeset.project.changeset.difference.removed[0].id).toBe(
      le.id
    );

    await approveProjectChangeRequest(app, changeset.id);
    // List engagements without changeset
    result = await readEngagements(app, project.id);
    expect(result.project.engagements.items.length).toBe(1);

    projectChangeset = await readProjectChangeset(
      app,
      project.id,
      changeset.id
    );
    expect(projectChangeset.project.changeset.difference.removed[0].id).toBe(
      le.id
    );
  });
});
