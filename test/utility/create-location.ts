import { faker } from '@faker-js/faker';
import { all as countries } from 'iso-3166-1';
import { isValidId } from '~/common';
import {
  CreateLocation,
  Location,
  LocationType,
} from '../../src/components/location/dto';
import { TestApp } from './create-app';
import { fragments } from './fragments';
import { gql } from './gql-tag';

export async function createLocation(
  app: TestApp,
  input: Partial<CreateLocation> = {},
) {
  const location: CreateLocation = {
    name: faker.lorem.word() + ' ' + faker.string.uuid(),
    type: LocationType.County,
    isoAlpha3: faker.helpers.arrayElement(countries()).alpha3,
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
    },
  );

  const actual: Location = result.createLocation.location;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(location.name);
  expect(actual.type.value).toBe(location.type);

  return actual;
}
