import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { all as countries } from 'iso-3166-1';
import { isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createLocation(
  app: TestApp,
  input: Partial<InputOf<typeof CreateLocationDoc>> = {},
) {
  const name = input.name ?? faker.lorem.word() + ' ' + faker.string.uuid();
  const result = await app.graphql.mutate(CreateLocationDoc, {
    input: {
      type: 'County',
      isoAlpha3: faker.helpers.arrayElement(countries()).alpha3,
      ...input,
      name,
    },
  });

  const actual = result.createLocation.location;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(name);

  return actual;
}

const CreateLocationDoc = graphql(
  `
    mutation createLocation($input: CreateLocation!) {
      createLocation(input: { location: $input }) {
        location {
          ...location
        }
      }
    }
  `,
  [fragments.location],
);
