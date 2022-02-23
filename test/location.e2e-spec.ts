import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generateId, isValidId } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { Location } from '../src/components/location';
import {
  createFundingAccount,
  createLocation,
  createRegion,
  createSession,
  createTestApp,
  fragments,
  registerUserWithPower,
  runAsAdmin,
  TestApp,
} from './utility';

describe('Location e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUserWithPower(app, [
      Powers.CreateLocation,
      Powers.CreateFundingAccount,
      Powers.CreateFieldZone,
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  // Create Location
  it('create location', async () => {
    const name = faker.company.companyName();
    await createLocation(app, { name });
  });

  // Read Location
  it('create & read location by id', async () => {
    const st = await createLocation(app);

    const { location: actual } = await app.graphql.query(
      gql`
        query location($id: ID!) {
          location(id: $id) {
            ...location
          }
        }
        ${fragments.location}
      `,
      {
        id: st.id,
      }
    );
    expect(actual.id).toBe(st.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name.value).toBe(st.name.value);
    expect(actual.isoAlpha3.value).toBe(st.isoAlpha3.value);
  });

  // Update Location
  it('update location', async () => {
    const st = await createLocation(app);
    const newName = faker.company.companyName();
    await runAsAdmin(app, async function () {
      const result = await app.graphql.mutate(
        gql`
          mutation updateLocation($input: UpdateLocationInput!) {
            updateLocation(input: $input) {
              location {
                ...location
              }
            }
          }
          ${fragments.location}
        `,
        {
          input: {
            location: {
              id: st.id,
              name: newName,
            },
          },
        }
      );
      const updated = result.updateLocation.location;
      expect(updated).toBeTruthy();
      expect(updated.name.value).toBe(newName);
    });
  });

  // Delete Location
  it.skip('delete location', async () => {
    const st = await createLocation(app);
    const result = await app.graphql.mutate(
      gql`
        mutation deleteLocation($id: ID!) {
          deleteLocation(id: $id) {
            __typename
          }
        }
      `,
      {
        id: st.id,
      }
    );
    const actual: Location | undefined = result.deleteLocation;
    expect(actual).toBeTruthy();
  });

  // List Locations
  it('list view of locations', async () => {
    // create a bunch of locations
    const numLocations = 2;
    await Promise.all(
      times(numLocations).map(
        async () =>
          await createLocation(app, {
            name: (await generateId()) + ' Location',
          })
      )
    );

    const { locations } = await app.graphql.query(gql`
      query {
        locations(input: { count: 15 }) {
          items {
            ...location
          }
          hasMore
          total
        }
      }
      ${fragments.location}
    `);

    expect(locations.items.length).toBeGreaterThanOrEqual(numLocations);
  });

  it('update location with defaultFieldRegion', async () => {
    const defaultFieldRegion = await createRegion(app);
    const l = await createLocation(app, {
      defaultFieldRegionId: defaultFieldRegion.id,
    });
    const newFieldRegion = await createRegion(app);
    await runAsAdmin(app, async () => {
      const result = await app.graphql.mutate(
        gql`
          mutation updateLocation($input: UpdateLocationInput!) {
            updateLocation(input: $input) {
              location {
                ...location
              }
            }
          }
          ${fragments.location}
        `,
        {
          input: {
            location: {
              id: l.id,
              defaultFieldRegionId: newFieldRegion.id,
            },
          },
        }
      );
      const updated = result.updateLocation.location;
      expect(updated).toBeTruthy();
      expect(updated.defaultFieldRegion.value.id).toBe(newFieldRegion.id);
    });
  });

  it('update location with funding account', async () => {
    const fundingAccount = await createFundingAccount(app);
    const st = await createLocation(app, {
      fundingAccountId: fundingAccount.id,
    });
    const newFundingAccount = await createFundingAccount(app);
    await runAsAdmin(app, async () => {
      const result = await app.graphql.mutate(
        gql`
          mutation updateLocation($input: UpdateLocationInput!) {
            updateLocation(input: $input) {
              location {
                ...location
              }
            }
          }
          ${fragments.location}
        `,
        {
          input: {
            location: {
              id: st.id,
              fundingAccountId: newFundingAccount.id,
            },
          },
        }
      );
      const updated = result.updateLocation.location;
      expect(updated).toBeTruthy();
      expect(updated.fundingAccount.value.id).toBe(newFundingAccount.id);
    });
  });
});
