import * as faker from 'faker';

import { CreateLanguage, Language } from '../../src/components/language';

import { TestApp } from './create-app';
import { fragments } from './fragments';
import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';

export async function createLanguage(
  app: TestApp,
  input: Partial<CreateLanguage> = {},
) {
  const language: CreateLanguage = {
    name: faker.address.country(),
    displayName: 'lang',
    beginFiscalYear: 2019,
    ethnologueName: 'ethno1',
    ethnologuePopulation: 20000,
    organizationPopulation: 500000,
    rodNumber: input.rodNumber || 12,
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

  const actual: Language | undefined = result.createLanguage?.language;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.name.value).toBe(language.name);

  return actual;
}
