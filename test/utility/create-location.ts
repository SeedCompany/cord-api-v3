import { faker } from '@faker-js/faker';
import { all as countries } from 'iso-3166-1';
import { isValidId } from '~/common';
import { graphql } from '~/graphql';
import {
  type CreateLocation,
  LocationType,
} from '../../src/components/location/dto';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

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
    graphql(
      `
        mutation createLocation($input: CreateLocationInput!) {
          createLocation(input: $input) {
            location {
              ...location
            }
          }
        }
      `,
      [fragments.location],
    ),
    {
      input: {
        location,
      },
    },
  );

  const actual = result.createLocation.location;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(location.name);
  expect(actual.type.value).toBe(location.type);

  return actual;
}
