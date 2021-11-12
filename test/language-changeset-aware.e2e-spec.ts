import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { Powers, Role } from '../src/components/authorization';
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
  registerUserWithPower,
  runAsAdmin,
  TestApp,
  updateProject,
} from './utility';
import { fragments } from './utility/fragments';
import { resetDatabase } from './utility/reset-database';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
} from './utility/transition-project';

const readLanguage = (app: TestApp, id: string, changeset?: string) =>
  app.graphql.query(
    gql`
      query language($id: ID!, $changeset: ID) {
        language(id: $id, changeset: $changeset) {
          ...language
        }
      }
      ${fragments.language}
    `,
    {
      id,
      changeset,
    }
  );

const activeProject = async (app: TestApp) => {
  const fundingAccount = await createFundingAccount(app);
  const location = await createLocation(app, {
    fundingAccountId: fundingAccount.id,
  });
  const fieldRegion = await createRegion(app);
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

describe('Language Changeset Aware e2e', () => {
  let app: TestApp;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    await registerUserWithPower(
      app,
      [Powers.CreateLanguage, Powers.CreateEthnologueLanguage],
      {
        roles: [Role.ProjectManager, Role.Administrator],
      }
    );
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('Update', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });
    const language = await createLanguage(app);
    await createLanguageEngagement(app, {
      projectId: project.id,
      languageId: language.id,
    });
    const newLanguageName = faker.company.companyName();
    // Update language name with changeset
    await app.graphql.mutate(
      gql`
        mutation updateLanguage($input: UpdateLanguageInput!) {
          updateLanguage(input: $input) {
            language {
              ...language
            }
          }
        }
        ${fragments.language}
      `,
      {
        input: {
          language: {
            id: language.id,
            name: newLanguageName,
          },
          changeset: changeset.id,
        },
      }
    );

    // read language without changeset
    let result = await readLanguage(app, language.id);
    expect(result.language.name.value === language.name.value);
    // read language with changeset
    result = await readLanguage(app, language.id, changeset.id);
    expect(result.language.name.value).toBe(newLanguageName);
    await approveProjectChangeRequest(app, changeset.id);
    result = await readLanguage(app, language.id);
    expect(result.language.name.value).toBe(newLanguageName);
  });
});
