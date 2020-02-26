import * as faker from 'faker';

import {
  TestApp,
  createLanguage,
  createSession,
  createTestApp,
  createUser,
} from './utility';

import { Language } from '../src/components/language/dto/language.dto';
import { fragments } from './utility/fragments';
import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import { times } from 'lodash';

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

  it('read one language by id', async () => {
    const language = await createLanguage(app);

    try {
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
        },
      );

      expect(actual.id).toBe(language.id);
      expect(isValid(actual.id)).toBeTruthy();
      expect(actual.name.value).toEqual(language.name.value);
    } catch (e) {
      console.log(`language id is ${language.id}`);
      console.error(e);
      fail();
    }
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
      },
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
      },
    );

    expect(result.deleteLanguage).toBeTruthy();
    try {
      await app.graphql.query(
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
        },
      );
    } catch (e) {
      // we expect this to throw. the language should have been deleted, therefor a subsequent read should fail
      expect(e.response.statusCode).toBe(404);
    }
    // expect(actual.id).toBe(language.id);
  });

  // LIST Languages
  it('List view of languages', async () => {
    // create a bunch of languages
    const numLanguages = 10;
    await Promise.all(
      times(numLanguages).map(() => createLanguage(app, { name: 'Italian' })),
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
});
