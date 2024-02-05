import { faker } from '@faker-js/faker';
import { IdOf } from '~/common';
import { FieldRegion } from '../src/components/field-region';
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
  gql,
  loginAsAdmin,
  TestApp,
} from './utility';
import { fragments } from './utility/fragments';
import { transitionNewProjectToActive } from './utility/transition-project';

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
    },
  );

const activeProject = async (app: TestApp) => {
  const fundingAccount = await createFundingAccount(app);
  const location = await createLocation(app, {
    fundingAccountId: fundingAccount.id,
  });
  const fieldRegion = await createRegion(app);

  const project = await createProject(app, {
    primaryLocationId: location.id,
    fieldRegionOverrideId: fieldRegion.id as IdOf<FieldRegion>,
  });
  await transitionNewProjectToActive(app, project);

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
      projectId: project.id,
    });
    const language = await createLanguage(app);
    await createLanguageEngagement(app, {
      projectId: project.id,
      languageId: language.id,
    });
    const newLanguageName = faker.company.name();
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
      },
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
