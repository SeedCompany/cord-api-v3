import { gql } from 'apollo-server-core';
import { generate, isValid } from 'shortid';
import { Country, CreateCountry } from '../../src/components/location';
import { TestApp } from './create-app';
import { createRegion } from './create-region';
import { fragments } from './fragments';

export async function createCountry(
  app: TestApp,
  input: Partial<CreateCountry> = {}
) {
  const country: CreateCountry = {
    name: 'Country' + generate(),
    regionId: input.regionId ?? (await createRegion(app)).id,
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createCountry($input: CreateCountryInput!) {
        createCountry(input: $input) {
          country {
            ...country
            region {
              value {
                ...region
              }
              canRead
              canEdit
            }
          }
        }
      }
      ${fragments.country}
      ${fragments.region}
    `,
    {
      input: {
        country,
      },
    }
  );

  const actual: Country = result.createCountry.country;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.name.value).toBe(country.name);

  return actual;
}
