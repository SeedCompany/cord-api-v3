import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { generate, isValid } from 'shortid';
import { CreateLanguage, Language } from '../../src/components/language';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createLanguage(
  app: TestApp,
  input: Partial<CreateLanguage> = {}
) {
  const language: CreateLanguage = {
    name: faker.address.country() + generate(),
    displayName: faker.company.companyName(),
    beginFiscalYear: faker.random.number(4),
    ethnologueName: faker.finance.accountName(),
    ethnologuePopulation: faker.random.number(5),
    organizationPopulation: faker.random.number(10),
    rodNumber: faker.random.number(100000),
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
