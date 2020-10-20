import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { isValidId, Sensitivity } from '../../src/common';
import {
  CreateLocation,
  Location,
  LocationType,
} from '../../src/components/location';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createLocation(
  app: TestApp,
  input: Partial<CreateLocation> = {}
) {
  const location: CreateLocation = {
    name: faker.random.word() + ' ' + faker.random.uuid(),
    type: LocationType.County,
    sensitivity: Sensitivity.High,
    isoAlpha3: faker.helpers.replaceSymbols('???'),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createLocation($input: CreateLocationInput!) {
        createLocation(input: $input) {
          location {
            ...location
          }
        }
      }
      ${fragments.location}
    `,
    {
      input: {
        location,
      },
    }
  );

  const actual: Location = result.createLocation.location;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(location.name);
  expect(actual.type.value).toBe(location.type);

  return actual;
}
