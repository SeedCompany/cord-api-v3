import { faker } from '@faker-js/faker';
import { gql } from 'apollo-server-core';
import { DateTime } from 'luxon';
import { isValidId } from '../../src/common';
import {
  CreateUnavailability,
  Unavailability,
} from '../../src/components/user/unavailability';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createUnavailability(
  app: TestApp,
  input: Partial<CreateUnavailability> = {}
) {
  const unavailability: CreateUnavailability = {
    userId: input.userId!,
    description: faker.address.country(),
    start: DateTime.utc(),
    end: DateTime.utc().plus({ years: 1 }),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createUnavailability($input: CreateUnavailabilityInput!) {
        createUnavailability(input: $input) {
          unavailability {
            ...unavailability
          }
        }
      }
      ${fragments.unavailability}
    `,
    {
      input: {
        unavailability: {
          ...unavailability,
        },
      },
    }
  );

  const actual: Unavailability = result.createUnavailability.unavailability;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
