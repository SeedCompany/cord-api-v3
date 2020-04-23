import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import {
  createLanguage,
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
    expect(actual.name.value).toEqual(language.name.value);
  });

  // UPDATE LANGUAGE
  it.skip('update language', async () => {
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
    const numLanguages = 10;
    await Promise.all(
      times(numLanguages).map(() =>
        createLanguage(app, { name: faker.address.country() + generate() })
      )
    );
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
});
