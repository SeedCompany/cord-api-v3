import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import { MarketingLocation } from '../src/components/marketing-location';
import {
  createMarketingLocation,
  createSession,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';

describe('MarketingLocation e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // Create Marketing Location
  it('create marketing location', async () => {
    const name = faker.company.companyName();
    await createMarketingLocation(app, { name });
  });

  // Read Marketing Location
  it('create & read marketing location by id', async () => {
    const st = await createMarketingLocation(app);

    const { marketingLocation: actual } = await app.graphql.query(
      gql`
        query st($id: ID!) {
          marketingLocation(id: $id) {
            ...marketingLocation
          }
        }
        ${fragments.marketingLocation}
      `,
      {
        id: st.id,
      }
    );
    expect(actual.id).toBe(st.id);
    expect(isValid(actual.id)).toBe(true);
    expect(actual.name.value).toBe(st.name.value);
  });

  // Update Marketing Location
  it('update marketing location', async () => {
    const st = await createMarketingLocation(app);
    const newName = faker.company.companyName();
    const result = await app.graphql.mutate(
      gql`
        mutation updateMarketingLocation(
          $input: UpdateMarketingLocationInput!
        ) {
          updateMarketingLocation(input: $input) {
            marketingLocation {
              ...marketingLocation
            }
          }
        }
        ${fragments.marketingLocation}
      `,
      {
        input: {
          marketingLocation: {
            id: st.id,
            name: newName,
          },
        },
      }
    );
    const updated = result.updateMarketingLocation.marketingLocation;
    expect(updated).toBeTruthy();
    expect(updated.name.value).toBe(newName);
  });

  // Delete Marketing Location
  it.skip('delete marketing location', async () => {
    const st = await createMarketingLocation(app);
    const result = await app.graphql.mutate(
      gql`
        mutation deleteMarketingLocation($id: ID!) {
          deleteMarketingLocation(id: $id)
        }
      `,
      {
        id: st.id,
      }
    );
    const actual: MarketingLocation | undefined =
      result.deleteMarketingLocation;
    expect(actual).toBeTruthy();
  });

  // List Marketing Locations
  it('list view of marketing locations', async () => {
    // create a bunch of marketing locations
    const numMarketingLocations = 2;
    await Promise.all(
      times(numMarketingLocations).map(() =>
        createMarketingLocation(app, { name: generate() + ' Marketing' })
      )
    );

    const { marketingLocations } = await app.graphql.query(gql`
      query {
        marketingLocations(input: { count: 15 }) {
          items {
            ...marketingLocation
          }
          hasMore
          total
        }
      }
      ${fragments.marketingLocation}
    `);

    expect(marketingLocations.items.length).toBeGreaterThanOrEqual(
      numMarketingLocations
    );
  });
});
