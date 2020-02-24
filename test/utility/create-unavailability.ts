import * as faker from 'faker';

import { CreateUnavailability, Unavailability } from '../../src/components/user/unavailability';

import { DateTime } from 'luxon';
import { TestApp } from './create-app';
import { createUser } from './create-user';
import { fragments } from './fragments';
import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';

export async function createUnavailability(
  app: TestApp,
  input: Partial<CreateUnavailability> = {},
) {
  const unavailability: CreateUnavailability = {
    userId: input.userId ,
    description: faker.address.country(),
    start:  DateTime.utc(),
    end: DateTime.utc().plus({years: 1}),
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
    },
  );

  const actual: Unavailability | undefined = result.createUnavailability?.unavailability;
  expect(actual).toBeTruthy();

  expect(isValid(actual?.id)).toBe(true);

  return actual;
}
