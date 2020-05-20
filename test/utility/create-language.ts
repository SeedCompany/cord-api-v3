import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { startCase } from 'lodash';
import { DateTime } from 'luxon';
import { isValid } from 'shortid';
import { CreateLanguage, Language } from '../../src/components/language';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export const randomLanguageName = () =>
  startCase(
    faker.fake(
      faker.random.arrayElement([
        '{{lorem.word}}',
        '{{lorem.word}}-{{lorem.word}}',
      ])
    )
  ).replace(' ', '-');

export async function createLanguage(
  app: TestApp,
  input: Partial<CreateLanguage> = {}
) {
  const language: CreateLanguage = {
    name: randomLanguageName(),
    displayName: randomLanguageName(),
    beginFiscalYear: faker.date
      .between(
        DateTime.fromObject({ year: 1990 }).toJSDate(),
        DateTime.local().toJSDate()
      )
      .getFullYear(),
    ethnologueName: faker.helpers.replaceSymbols('???'),
    ethnologuePopulation: faker.random.number({ min: 100, max: 10000000 }),
    organizationPopulation: faker.random.boolean()
      ? faker.random.number({ min: 100, max: 10000000 })
      : undefined,
    rodNumber: faker.random.number({ min: 1000, max: 99999 }),
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
