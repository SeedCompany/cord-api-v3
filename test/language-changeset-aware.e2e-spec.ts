import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type ID } from '~/common';
import { graphql } from '~/graphql';
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
  fragments,
  loginAsAdmin,
  type TestApp,
} from './utility';
import { forceProjectTo } from './utility/transition-project';

const readLanguage = (app: TestApp, id: ID, changeset?: ID) =>
  app.graphql.query(
    graphql(
      `
        query language($id: ID!, $changeset: ID) {
          language(id: $id, changeset: $changeset) {
            ...language
          }
        }
      `,
      [fragments.language],
    ),
    {
      id,
      changeset,
    },
  );

const activeProject = async (app: TestApp) => {
  const fundingAccount = await createFundingAccount(app);
  const location = await createLocation(app, {
    fundingAccount: fundingAccount.id,
  });
  const fieldRegion = await createRegion(app);

  const project = await createProject(app, {
    primaryLocation: location.id,
    fieldRegion: fieldRegion.id,
  });
  await forceProjectTo(app, project.id, 'Active');

  return project;
};

// TODO currently causing out of memory errors on CI
describe.skip('Language Changeset Aware e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    // Only admins can modify languages. This will probably need changes in app code,
    // to allow others to modify certain language props within changesets.
    await loginAsAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Update', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      project: project.id,
    });
    const language = await createLanguage(app);
    await createLanguageEngagement(app, {
      project: project.id,
      language: language.id,
    });
    const newLanguageName = faker.company.name();
    // Update language name with changeset
    await app.graphql.mutate(
      graphql(
        `
          mutation updateLanguage($input: UpdateLanguageInput!) {
            updateLanguage(input: $input) {
              language {
                ...language
              }
            }
          }
        `,
        [fragments.language],
      ),
      {
        input: {
          language: {
            id: language.id,
            name: newLanguageName,
          },
          changeset: changeset.id,
        },
      },
    );

    // read language without changeset
    let result = await readLanguage(app, language.id);
    expect(result.language.name.value).toBe(language.name.value);
    // read language with changeset
    result = await readLanguage(app, language.id, changeset.id);
    expect(result.language.name.value).toBe(newLanguageName);
    await approveProjectChangeRequest(app, changeset.id);
    result = await readLanguage(app, language.id);
    expect(result.language.name.value).toBe(newLanguageName);
  });
});
