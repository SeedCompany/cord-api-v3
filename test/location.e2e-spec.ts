import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { times } from 'lodash';
import { generateId, isValidId } from '../src/common';
import { Role } from '../src/components/authorization';
import { Powers } from '../src/components/authorization/dto/powers';
import { Location } from '../src/components/location';
import { User } from '../src/components/user';
import {
  createFundingAccount,
  createLocation,
  createRegion,
  createSession,
  createTestApp,
  fragments,
  login,
  registerUser,
  registerUserWithPower,
  TestApp,
} from './utility';
import { resetDatabase } from './utility/reset-database';

describe('Location e2e', () => {
  let app: TestApp;
  let db: Connection;
  let user: User;
  let userPassword: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    user = await registerUserWithPower(
      app,
      [Powers.CreateLocation, Powers.CreateFundingAccount],
      { password: userPassword }
    );
  });

  afterAll(async () => {
    await resetDatabase(db);
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
    await registerUser(app, { roles: [Role.Administrator] });
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
    await login(app, { email: user.email.value, password: userPassword });
  });

  // Delete Location
  it.skip('delete location', async () => {
    const st = await createLocation(app);
    const result = await app.graphql.mutate(
      gql`
        mutation deleteLocation($id: ID!) {
          deleteLocation(id: $id)
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

  it('update location with funding account', async () => {
    const fundingAccount = await createFundingAccount(app);
    const st = await createLocation(app, {
      fundingAccountId: fundingAccount.id,
    });
    const newFundingAccount = await createFundingAccount(app);
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
