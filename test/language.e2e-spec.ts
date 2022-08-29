import { faker } from '@faker-js/faker';
import { times } from 'lodash';
import { InputException, isValidId } from '../src/common';
import { UpdateLanguage } from '../src/components/language';
import {
  createLanguage,
  createLanguageEngagement,
  createLanguageMinimal,
  createProject,
  createSession,
  createTestApp,
  expectNotFound,
  gql,
  loginAsAdmin,
  TestApp,
} from './utility';
import { fragments } from './utility/fragments';

describe('Language e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    // Only admins can modify languages
    await loginAsAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a language', async () => {
    const language = await createLanguage(app);
    expect(language.id).toBeDefined();
  });

  it('read one language by id', async () => {
    const language = await createLanguage(app);

    const { language: actual } = await app.graphql.query(
      gql`
        query language($id: ID!) {
          language(id: $id) {
            ...language
          }
        }
        ${fragments.language}
      `,
      {
        id: language.id,
      }
    );

    expect(actual.id).toBe(language.id);
    expect(isValidId(actual.id)).toBeTruthy();
    expect(actual.ethnologue.population.value).toEqual(
      language.ethnologue.population.value
    );
    expect(actual.name.value).toEqual(language.name.value);
  });

  describe('Updates', () => {
    it('simple', async () => {
      const language = await createLanguage(app);
      const newName = faker.company.name();

      const updated = await updateLanguage(app, {
        id: language.id,
        name: newName,
      });
      expect(updated.name.value).toBe(newName);
    });

    it('empty ethnologue', async () => {
      const language = await createLanguage(app);
      await updateLanguage(app, {
        id: language.id,
        ethnologue: {},
      });
      // no error, so all good
    });

    it('a single language ethnologue property when language is minimally defined', async () => {
      const language = await createLanguageMinimal(app);
      const newEthnologueCode = faker.helpers
        .replaceSymbols('???')
        .toLowerCase();

      const updated = await updateLanguage(app, {
        id: language.id,
        ethnologue: {
          code: newEthnologueCode,
        },
      });
      expect(updated.ethnologue.code.value).toBe(newEthnologueCode);
    });
  });

  // DELETE LANGUAGE
  it('delete language', async () => {
    const language = await createLanguage(app);

    const result = await app.graphql.mutate(
      gql`
        mutation deleteLanguage($id: ID!) {
          deleteLanguage(id: $id) {
            __typename
          }
        }
      `,
      {
        id: language.id,
      }
    );

    expect(result.deleteLanguage).toBeTruthy();
    await expectNotFound(
      app.graphql.query(
        gql`
          query language($id: ID!) {
            language(id: $id) {
              ...language
            }
          }
          ${fragments.language}
        `,
        {
          id: language.id,
        }
      )
    );
  });

  // LIST Languages
  it('List view of languages', async () => {
    // create a bunch of languages
    const numLanguages = 2;
    await Promise.all(times(numLanguages).map(() => createLanguage(app)));

    // test reading new lang
    const { languages } = await app.graphql.query(gql`
      query {
        languages {
          items {
            ...language
          }
          hasMore
          total
        }
      }
      ${fragments.language}
    `);

    expect(languages.items.length).toBeGreaterThan(numLanguages);
  });

  it('List with projects -> engagements -> engagement status should not error', async () => {
    const lang = await createLanguage(app);
    const project = await createProject(app);
    await app.graphql.mutate(
      gql`
        mutation createLanguageEngagement(
          $input: CreateLanguageEngagementInput!
        ) {
          createLanguageEngagement(input: $input) {
            engagement {
              status {
                transitions {
                  to
                }
              }
            }
          }
        }
      `,
      {
        input: {
          engagement: {
            languageId: lang.id,
            projectId: project.id,
          },
        },
      }
    );
    // test reading new lang
    const result = await app.graphql.query(gql`
      query {
        languages {
          items {
            projects {
              items {
                engagements {
                  items {
                    status {
                      transitions {
                        to
                      }
                    }
                  }
                }
              }
            }
          }
          hasMore
          total
        }
      }
    `);
    expect(result).toBeTruthy();
  });

  it('The list of projects the language is engagement in', async () => {
    const numProjects = 1;
    const language = await createLanguage(app);
    const project = await createProject(app);
    const languageId = language.id;
    const projectId = project.id;

    await Promise.all(
      times(numProjects).map(() =>
        createLanguageEngagement(app, {
          projectId,
          languageId,
        })
      )
    );

    const queryProject = await app.graphql.query(
      gql`
        query language($id: ID!) {
          language(id: $id) {
            ...language
            projects {
              items {
                ...project
              }
              hasMore
              total
            }
          }
        }
        ${fragments.language},
        ${fragments.project}
      `,
      {
        id: language.id,
      }
    );
    expect(queryProject.language.projects.items.length).toBe(numProjects);
    expect(queryProject.language.projects.total).toBe(numProjects);
  });

  it('should throw error if signLanguageCode is not valid', async () => {
    const signLanguageCode = 'XXX1';
    await expect(
      createLanguage(app, { signLanguageCode })
    ).rejects.toThrowError(new InputException('Input validation failed'));
  });

  it('should throw error if trying to set hasExternalFirstScripture=true while language has engagements that have firstScripture=true', async () => {
    const language = await createLanguage(app);
    await createLanguageEngagement(app, {
      languageId: language.id,
      firstScripture: true,
    });

    await expect(
      app.graphql.mutate(
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
              hasExternalFirstScripture: true,
            },
          },
        }
      )
    ).rejects.toThrowError(
      'hasExternalFirstScripture can be set to true if the language has no engagements that have firstScripture=true'
    );
  });

  it('can set hasExternalFirstScripture=true if language has no engagements that have firstScripture=true', async () => {
    const language = await createLanguage(app);
    await createLanguageEngagement(app, {
      languageId: language.id,
      firstScripture: false,
    });

    const updated = await updateLanguage(app, {
      id: language.id,
      hasExternalFirstScripture: true,
    });
    expect(updated.hasExternalFirstScripture.value).toBe(true);
  });

  it('presetInventory flag', async () => {
    const project = await createProject(app, { presetInventory: true });
    const language = await createLanguage(app);
    await createLanguageEngagement(app, {
      projectId: project.id,
      languageId: language.id,
    });

    const { language: actual } = await app.graphql.query(
      gql`
        query language($id: ID!) {
          language(id: $id) {
            ...language
          }
        }
        ${fragments.language}
      `,
      {
        id: language.id,
      }
    );

    expect(actual.presetInventory.value).toBe(true);
  });

  it('List view of languages by presetInventory flag', async () => {
    const numLanguages = 2;

    await Promise.all(times(numLanguages).map(() => createLanguage(app)));
    // create presetInventory language
    const project = await createProject(app, { presetInventory: true });
    const language = await createLanguage(app);
    await createLanguageEngagement(app, {
      projectId: project.id,
      languageId: language.id,
    });

    const { languages } = await app.graphql.query(gql`
      query {
        languages(input: { filter: { presetInventory: true } }) {
          items {
            ...language
          }
          hasMore
          total
        }
      }
      ${fragments.language}
    `);

    expect(languages.items.length).toBeGreaterThan(1);
  });
});

async function updateLanguage(app: TestApp, update: Partial<UpdateLanguage>) {
  const result = await app.graphql.mutate(
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
        language: update,
      },
    }
  );
  const updated = result.updateLanguage.language;
  expect(updated.id).toBe(update.id);
  return updated;
}
