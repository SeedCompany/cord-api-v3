import { faker } from '@faker-js/faker';
import { CalendarDate, generateId, ID, isValidId } from '../../src/common';
import {
  CreateEthnologueLanguage,
  CreateLanguage,
  Language,
} from '../../src/components/language';
import { SecuredLocationList } from '../../src/components/location';
import { TestApp } from './create-app';
import { fragments } from './fragments';
import { gql } from './gql-tag';

export async function listLanguageIds(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        languages(input: {}) {
          items {
            id
          }
        }
      }
    `,
  );
  const languages = result.languages.items;
  expect(languages).toBeTruthy();
  return languages;
}

export async function readOneLanguageLocation(
  app: TestApp,
  langId: string,
): Promise<SecuredLocationList> {
  const result = await app.graphql.query(
    gql`
      query {
        language(id: "${langId}") {
          ...language
        }
      }
      ${fragments.language}
    `,
  );

  const actual = result.language.locations;
  expect(actual).toBeTruthy();
  return actual;
}
export async function readOneLanguageEthnologue(
  app: TestApp,
  langId: ID,
): Promise<Language> {
  const result = await app.graphql.query(
    gql`
      query {
        language(id: "${langId}") {
          ...language
        }
      }
      ${fragments.language}
    `,
  );

  const actual = result.language.ethnologue;
  expect(actual).toBeTruthy();
  return actual;
}

export async function readOneLanguage(app: TestApp, id: ID): Promise<Language> {
  const result = await app.graphql.query(
    gql`
      query {
        language(id: "${id}") {
          ...language
        }
      }
      ${fragments.language}
    `,
  );

  const actual = result.language;
  expect(actual).toBeTruthy();
  expect(actual.id).toEqual(id);
  return actual;
}

export async function createLanguage(
  app: TestApp,
  input: Partial<CreateLanguage> = {},
) {
  const ethnologueLanguage: CreateEthnologueLanguage = {
    code: faker.helpers.replaceSymbols('???').toLowerCase(),
    provisionalCode: faker.helpers.replaceSymbols('???').toLowerCase(),
    name: faker.person.firstName(),
    // this represents the largest number that is less than the 32-bit max for GraphQL
    population: faker.number.int({ max: 2147483647 }),
    ...input.ethnologue,
  };
  const language: CreateLanguage = {
    name: faker.location.country() + '' + (await generateId()),
    displayName: faker.company.name() + '' + (await generateId()),
    displayNamePronunciation: faker.lorem.word(),
    isDialect: faker.datatype.boolean(),
    // this represents the largest number that is less than the 32-bit max for GraphQL
    populationOverride: faker.number.int({ max: 2147483647 }),
    registryOfDialectsCode: faker.number
      .int({ min: 10000, max: 99999 })
      .toString(),
    leastOfThese: faker.datatype.boolean(),
    leastOfTheseReason: faker.lorem.sentence(),
    ethnologue: ethnologueLanguage,
    signLanguageCode:
      faker.helpers.replaceSymbols('??').toUpperCase() +
      faker.number.int({ min: 10, max: 99 }).toString(),
    sponsorEstimatedEndDate: CalendarDate.fromISO('1991-01-01'),
    tags: ['tag1', 'tag2'],
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createLanguage($input: CreateLanguageInput!) {
        createLanguage(input: $input) {
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
          ...language,
        },
      },
    },
  );

  const actual: Language = result.createLanguage.language;

  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(language.name);

  return actual;
}

export async function createLanguageMinimal(app: TestApp) {
  const languageName = faker.location.country() + '' + (await generateId());
  const result = await app.graphql.mutate(
    gql`
      mutation createLanguage($input: CreateLanguageInput!) {
        createLanguage(input: $input) {
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
          name: languageName,
          displayName: faker.company.name() + '' + (await generateId()),
        },
      },
    },
  );

  const actual: Language = result.createLanguage.language;

  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(languageName);

  return actual;
}
