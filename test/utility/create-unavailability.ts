import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { DateTime } from 'luxon';
import type { SetOptional } from 'type-fest';
import { isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createUnavailability(
  app: TestApp,
  input: SetOptional<
    InputOf<typeof CreateUnavailabilityDoc>,
    'description' | 'start' | 'end'
  >,
) {
  const result = await app.graphql.mutate(CreateUnavailabilityDoc, {
    input: {
      description: faker.location.country(),
      start: DateTime.now().toISO(),
      end: DateTime.now().plus({ years: 1 }).toISO(),
      ...input,
    },
  });

  const actual = result.createUnavailability.unavailability;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}

const CreateUnavailabilityDoc = graphql(
  `
    mutation createUnavailability($input: CreateUnavailability!) {
      createUnavailability(input: { unavailability: $input }) {
        unavailability {
          ...unavailability
        }
      }
    }
  `,
  [fragments.unavailability],
);
