import { faker } from '@faker-js/faker';
import { gql } from 'apollo-server-core';
import countries from 'iso-3166-1/dist/iso-3166';
import { ID, isValidId } from '../../src/common';
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
    isoAlpha3: faker.helpers.arrayElement(countries).alpha3,
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

export async function addLocationToLanguage(
  app: TestApp,
  locationId: ID,
  languageId: ID
) {
  const result = await app.graphql.mutate(
    gql`
      mutation addLocationToLanguage($langId: ID!, $locId: ID!) {
        addLocationToLanguage(languageId: $langId, locationId: $locId) {
          locations {
            items {
              ...location
            }
          }
        }
      }
      ${fragments.location}
    `,
    {
      langId: languageId,
      locId: locationId,
    }
  );
  const actual = result.addLocationToLanguage.locations;
  expect(actual).toBeTruthy();
  expect(actual.items).not.toHaveLength(0);
}
