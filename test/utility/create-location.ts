import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import countries from 'iso-3166-1/dist/iso-3166';
import { isValidId } from '../../src/common';
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
    name: faker.random.word() + ' ' + faker.datatype.uuid(),
    type: LocationType.County,
    isoAlpha3: faker.random.arrayElement(countries).alpha3,
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
