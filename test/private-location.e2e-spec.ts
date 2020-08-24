import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import { PrivateLocation } from '../src/components/location';
import {
  createPrivateLocation,
  createSession,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';

describe('PrivateLocation e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // Create Private Location
  it('create private location', async () => {
    const name = faker.company.companyName();
    await createPrivateLocation(app, { name });
  });

  // Read Private Location
  it('create & read private location by id', async () => {
    const st = await createPrivateLocation(app);

    const { privateLocation: actual } = await app.graphql.query(
      gql`
        query st($id: ID!) {
          privateLocation(id: $id) {
            ...privateLocation
          }
        }
        ${fragments.privateLocation}
      `,
      {
        id: st.id,
      }
    );
    expect(actual.id).toBe(st.id);
    expect(isValid(actual.id)).toBe(true);
    expect(actual.name.value).toBe(st.name.value);
  });

  // Update Private Location
  it('update private location', async () => {
    const st = await createPrivateLocation(app);
    const newName = faker.company.companyName();
    const result = await app.graphql.mutate(
      gql`
        mutation updatePrivateLocation($input: UpdatePrivateLocationInput!) {
          updatePrivateLocation(input: $input) {
            privateLocation {
              ...privateLocation
            }
          }
        }
        ${fragments.privateLocation}
      `,
      {
        input: {
          privateLocation: {
            id: st.id,
            name: newName,
          },
        },
      }
    );
    const updated = result.updatePrivateLocation.privateLocation;
    expect(updated).toBeTruthy();
    expect(updated.name.value).toBe(newName);
  });

  // Delete Private Location
  it.skip('delete private location', async () => {
    const st = await createPrivateLocation(app);
    const result = await app.graphql.mutate(
      gql`
        mutation deletePrivateLocation($id: ID!) {
          deletePrivateLocation(id: $id)
        }
      `,
      {
        id: st.id,
      }
    );
    const actual: PrivateLocation | undefined = result.deletePrivateLocation;
    expect(actual).toBeTruthy();
  });

  // List Private Locations
  it.skip('list view of private locations', async () => {
    // create a bunch of private locations
    const numPrivateLocations = 2;
    await Promise.all(
      times(numPrivateLocations).map(() =>
        createPrivateLocation(app, { name: generate() + ' PrivateLocation' })
      )
    );

    const { privateLocations } = await app.graphql.query(gql`
      query {
        privateLocations(input: { count: 15 }) {
          items {
            ...PrivateLocation
          }
          hasMore
          total
        }
      }
      ${fragments.privateLocation}
    `);

    expect(privateLocations.items.length).toBeGreaterThanOrEqual(
      numPrivateLocations
    );
  });
});
