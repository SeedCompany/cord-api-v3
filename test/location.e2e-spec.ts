import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import { Location } from '../src/components/location';
import {
  createLocation,
  createSession,
  createTestApp,
  fragments,
  registerUser,
  TestApp,
} from './utility';

describe('Location e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app);
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
    expect(isValid(actual.id)).toBe(true);
    expect(actual.name.value).toBe(st.name.value);
  });

  // Update Location
  it('update location', async () => {
    const st = await createLocation(app);
    const newName = faker.company.companyName();
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
      times(numLocations).map(() =>
        createLocation(app, { name: generate() + ' Locaiton' })
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
});
