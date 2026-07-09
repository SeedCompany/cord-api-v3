import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { all as countries } from 'iso-3166-1';
import { isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

// Deal codes from a shuffled deck instead of sampling — the PG partial unique
// on iso_alpha3 makes random real-code collisions across a spec file likely
// (only ~250 codes exist). Wraps around if a spec ever exhausts the deck.
const isoDeck = faker.helpers.shuffle(countries().map((c) => c.alpha3));
let isoDeckIdx = 0;
const nextIso = () => isoDeck[isoDeckIdx++ % isoDeck.length]!;

export async function createLocation(
  app: TestApp,
  input: Partial<InputOf<typeof CreateLocationDoc>> = {},
) {
  const name = input.name ?? faker.lorem.word() + ' ' + faker.string.uuid();
  const result = await app.graphql.mutate(CreateLocationDoc, {
    input: {
      type: 'County',
      isoAlpha3: nextIso(),
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
      createLocation(input: $input) {
        location {
          ...location
        }
      }
    }
  `,
  [fragments.location],
);
