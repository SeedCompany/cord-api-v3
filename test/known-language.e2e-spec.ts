import { beforeAll, describe, expect, it } from '@jest/globals';
import { graphql } from '~/graphql';
import {
  createLanguage,
  createPerson,
  createSession,
  createTestApp,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';

describe('KnownLanguage e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app);
  });

  it('adds, lists, and removes a known language at a proficiency', async () => {
    const person = await createPerson(app);
    const language = await runAsAdmin(app, createLanguage);

    await app.graphql.mutate(ModifyDoc('createKnownLanguage'), {
      user: person.id,
      language: language.id,
      languageProficiency: 'Skilled',
    });

    let result = await app.graphql.query(KnownLanguagesDoc, { id: person.id });
    expect(result.user.knownLanguages).toEqual([
      { language: { id: language.id }, proficiency: 'Skilled' },
    ]);

    // Re-adding the same edge is idempotent.
    await app.graphql.mutate(ModifyDoc('createKnownLanguage'), {
      user: person.id,
      language: language.id,
      languageProficiency: 'Skilled',
    });
    result = await app.graphql.query(KnownLanguagesDoc, { id: person.id });
    expect(result.user.knownLanguages).toHaveLength(1);

    await app.graphql.mutate(ModifyDoc('deleteKnownLanguage'), {
      user: person.id,
      language: language.id,
      languageProficiency: 'Skilled',
    });
    result = await app.graphql.query(KnownLanguagesDoc, { id: person.id });
    expect(result.user.knownLanguages).toHaveLength(0);
  });

  it('tracks the same language at multiple proficiencies independently', async () => {
    const person = await createPerson(app);
    const language = await runAsAdmin(app, createLanguage);

    for (const proficiency of ['Beginner', 'Fluent'] as const) {
      await app.graphql.mutate(ModifyDoc('createKnownLanguage'), {
        user: person.id,
        language: language.id,
        languageProficiency: proficiency,
      });
    }
    let result = await app.graphql.query(KnownLanguagesDoc, { id: person.id });
    expect(
      result.user.knownLanguages
        .map((k) => k.proficiency)
        .sort((a, b) => a.localeCompare(b)),
    ).toEqual(['Beginner', 'Fluent']);

    // Removing one proficiency leaves the other.
    await app.graphql.mutate(ModifyDoc('deleteKnownLanguage'), {
      user: person.id,
      language: language.id,
      languageProficiency: 'Beginner',
    });
    result = await app.graphql.query(KnownLanguagesDoc, { id: person.id });
    expect(result.user.knownLanguages).toEqual([
      { language: { id: language.id }, proficiency: 'Fluent' },
    ]);
  });
});

const ModifyDoc = (name: 'createKnownLanguage' | 'deleteKnownLanguage') =>
  graphql(`
    mutation Modify(
      $user: ID!
      $language: ID!
      $languageProficiency: LanguageProficiency!
    ) {
      ${name}(
        user: $user
        language: $language
        languageProficiency: $languageProficiency
      ) {
        id
      }
    }
  `);

const KnownLanguagesDoc = graphql(`
  query KnownLanguages($id: ID!) {
    user(id: $id) {
      knownLanguages {
        language {
          id
        }
        proficiency
      }
    }
  }
`);
