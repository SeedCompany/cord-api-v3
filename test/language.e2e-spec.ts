import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { isValid } from 'shortid';
import {
  createLanguage,
  createLanguageEngagement,
  createLanguageMinimal,
  createProject,
  createSession,
  createTestApp,
  createUser,
  expectNotFound,
  TestApp,
} from './utility';
import { fragments } from './utility/fragments';

describe('Language e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a language', async () => {
    const language = await createLanguage(app);
    expect(language.id).toBeDefined();
  });

  it('should have unique name', async () => {
    const name = faker.company.companyName();
    await createLanguage(app, { name });
    await expect(createLanguage(app, { name })).rejects.toThrowError();
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
    expect(isValid(actual.id)).toBeTruthy();
    expect(actual.ethnologue.population.value).toEqual(
      language.ethnologue.population.value
    );
    expect(actual.name.value).toEqual(language.name.value);
  });

  // UPDATE LANGUAGE
  it('update language', async () => {
    const language = await createLanguage(app);
    const newName = faker.company.companyName();

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
          language: {
            id: language.id,
            name: newName,
          },
        },
      }
    );
    const updated = result.updateLanguage.language;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(language.id);
    expect(updated.name.value).toBe(newName);
  });

  // UPDATE LANGUAGE: update a language ethnologue when language is minimally defined.
  it('update a single language ethnologue property when language is minimally defined', async () => {
    const languageMinimal = await createLanguageMinimal(app);
    const newEthnologueCode = faker.helpers.replaceSymbols('???').toLowerCase();

    const result = await app.graphql.mutate(
      gql`
        mutation UpdateLanguageEthnologue($input: UpdateLanguageInput!) {
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
            id: languageMinimal.id,
            ethnologue: {
              code: newEthnologueCode,
            },
          },
        },
      }
    );

    const updated = result.updateLanguage.language;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(languageMinimal.id);
    expect(updated.ethnologue.code.value).toBe(newEthnologueCode);
  });

  // DELETE LANGUAGE
  it('delete language', async () => {
    const language = await createLanguage(app);

    const result = await app.graphql.mutate(
      gql`
        mutation deleteLanguage($id: ID!) {
          deleteLanguage(id: $id)
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

  it('should check language has all required properties', async () => {
    // create a test language
    const language = await createLanguage(app);
    // test it has proper schema
    const result = await app.graphql.query(gql`
      query {
        checkLanguageConsistency
      }
    `);
    expect(result.checkLanguageConsistency).toBeTruthy();
    // delete the node
    await app.graphql.mutate(
      gql`
        mutation deleteLanguage($id: ID!) {
          deleteLanguage(id: $id)
        }
      `,
      {
        id: language.id,
      }
    );
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
    ).rejects.toThrowError();
  });
});
