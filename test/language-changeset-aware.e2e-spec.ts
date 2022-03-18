import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { Role } from '../src/components/authorization';
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
  const fundingAccount = await runInIsolatedSession(app, async () => {
    await registerUser(app, { roles: [Role.Administrator] }); // only admin can create funding account for now
    return await createFundingAccount(app);
  });
  const location = await runInIsolatedSession(app, async () => {
    await registerUser(app, { roles: [Role.Administrator] }); // only admin can create location for now
    return await createLocation(app, { fundingAccountId: fundingAccount.id });
  });
  const fieldRegion = await runInIsolatedSession(app, async () => {
    await registerUser(app, { roles: [Role.Administrator] }); // only admin can create funding account for now
    return await createRegion(app);
  });
  await createRegion(app);
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

// TODO currently causing out of memory errors on CI
describe.skip('Language Changeset Aware e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [Role.ProjectManager, Role.Administrator],
    });
    //todo
    // [Powers.CreateLanguage, Powers.CreateEthnologueLanguage],
  });

  afterAll(async () => {
    await app.close();
  });

  it('Update', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });
    const language = await runInIsolatedSession(app, async () => {
      await registerUser(app, { roles: [Role.Administrator] }); // only admin can create language for now
      return await createLanguage(app);
    });
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
