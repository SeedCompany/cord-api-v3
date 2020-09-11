import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { generate, isValid } from 'shortid';
import {
  CreateEthnologueLanguage,
  CreateLanguage,
  Language,
} from '../../src/components/language';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createLanguage(
  app: TestApp,
  input: Partial<CreateLanguage> = {}
) {
  const ethnologueLanguage: CreateEthnologueLanguage = {
    id: faker.random.word() + '' + generate(),
    code: faker.helpers.replaceSymbols('???').toLowerCase(),
    provisionalCode: faker.helpers.replaceSymbols('???').toLowerCase(),
    name: faker.name.firstName(),
    population: faker.random.number(),
    ...input.ethnologue,
  };
  const language: CreateLanguage = {
    name: faker.address.country() + '' + generate(),
    displayName: faker.company.companyName() + '' + generate(),
    displayNamePronunciation: faker.random.word(),
    isDialect: faker.random.boolean(),
    populationOverride: faker.random.number(),
    registryOfDialectsCode: faker.random
      .number({ min: 10000, max: 99999 })
      .toString(),
    leastOfThese: faker.random.boolean(),
    leastOfTheseReason: faker.lorem.sentence(),
    ethnologue: ethnologueLanguage,
    signLanguageCode:
      faker.helpers.replaceSymbols('??').toUpperCase() +
      faker.random.number({ min: 10, max: 99 }).toString(),
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
    }
  );

  const actual: Language = result.createLanguage.language;

  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.name.value).toBe(language.name);

  return actual;
}

export async function createLanguageMinimal(app: TestApp) {
  const languageName = faker.address.country() + '' + generate();
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
          displayName: faker.company.companyName() + '' + generate(),
        },
      },
    }
  );

  const actual: Language = result.createLanguage.language;

  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.name.value).toBe(languageName);

  return actual;
}
