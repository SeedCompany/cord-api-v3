import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { isValid } from 'shortid';
import { Country, Zone } from '../src/components/location';
import { User } from '../src/components/user';
import {
  createSession,
  createTestApp,
  createUser,
  createZone,
  fragments,
  TestApp,
} from './utility';
import { createCountry } from './utility/create-country';
import { createRegion } from './utility/create-region';

describe('Country e2e', () => {
  let app: TestApp;
  let director: User;
  let zone: Zone;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    director = await createUser(app);
    zone = await createZone(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a country', async () => {
    const country = await createCountry(app);
    expect(country.id).toBeDefined();
  });

  it('should have unique name', async () => {
    await createCountry(app);
    await expect(createCountry(app)).rejects.toThrowError();
  });

  it('read one country by id', async () => {
    const country = await createCountry(app);

    const { location: actual } = await app.graphql.query(
      gql`
        query country($id: ID!) {
          location(id: $id) {
            __typename
            ... on Country {
              ...country
              region {
                value {
                  ...region
                  director {
                    value {
                      ...user
                    }
                    canEdit
                    canRead
                  }
                  zone {
                    value {
                      ...zone
                    }
                    canEdit
                    canRead
                  }
                }
                canEdit
                canRead
              }
            }
          }
        }
        ${fragments.country}
        ${fragments.zone}
        ${fragments.region}
        ${fragments.user}
      `,
      {
        id: country.id,
      }
    );

    expect(actual.id).toBe(country.id);
    expect(isValid(actual.id)).toBe(true);
    expect(actual.name).toEqual(country.name);
  });

  it('update region for a country', async () => {
    const country = await createCountry(app);
    const newRegion = await createRegion(app, {
      directorId: director.id,
      zoneId: zone.id,
    });

    const result = await app.graphql.mutate(
      gql`
        mutation updateCountry($input: UpdateCountryInput!) {
          updateCountry(input: $input) {
            country {
              ...country
              region {
                value {
                  ...region
                }
              }
            }
          }
        }
        ${fragments.country}
        ${fragments.region}
      `,
      {
        input: {
          country: {
            id: country.id,
            regionId: newRegion.id,
          },
        },
      }
    );
    const updated = result.updateCountry.country;

    expect(updated).toBeTruthy();
    expect(updated.id).toBe(country.id);
    expect(updated.region.value.id).toBe(newRegion.id);
  });

  it('update name for a country', async () => {
    const country = await createCountry(app);
    const newName = faker.company.companyName();

    const result = await app.graphql.mutate(
      gql`
        mutation updateCountry($input: UpdateCountryInput!) {
          updateCountry(input: $input) {
            country {
              ...country
            }
          }
        }
        ${fragments.country}
      `,
      {
        input: {
          country: {
            id: country.id,
            name: newName,
          },
        },
      }
    );
    const updated = result.updateCountry.country;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(country.id);
    expect(updated.name.value).toBe(newName);
  });

  // delete country
  it('delete country', async () => {
    const country = await createCountry(app);

    const result = await app.graphql.mutate(
      gql`
        mutation deleteLocation($id: ID!) {
          deleteLocation(id: $id)
        }
      `,
      {
        id: country.id,
      }
    );
    const actual: Country | undefined = result.deleteLocation;
    expect(actual).toBeTruthy();
  });

  it.skip('returns a list of countries', async () => {
    await Promise.all(
      ['Arendale', 'South Arendale'].map(e => createCountry(app, { name: e }))
    );

    const { locations } = await app.graphql.query(gql`
      query {
        locations(input: { filter: { name: "Arendale", types: ["country"] } }) {
          items {
            ...country
          }
          hasMore
          total
        }
      }
      ${fragments.country}
    `);

    expect(locations.items.length).toBeGreaterThanOrEqual(2);
  });
});
