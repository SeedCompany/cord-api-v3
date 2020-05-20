import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { DateTime } from 'luxon';
import { isValid } from 'shortid';
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
  const start = DateTime.fromJSDate(
    faker.date.between(
      DateTime.local().minus({ year: 1 }).toJSDate(),
      DateTime.local().plus({ year: 1 }).toJSDate()
    )
  );
  const end = DateTime.fromJSDate(
    faker.date.between(start.toJSDate(), start.plus({ month: 3 }).toJSDate())
  );
  const unavailability: CreateUnavailability = {
    userId: input.userId!,
    description: faker.lorem.sentence(),
    start,
    end,
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

  expect(isValid(actual.id)).toBe(true);

  return actual;
}
