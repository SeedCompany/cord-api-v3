import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate } from 'shortid';
import { Favorite } from '../src/components/favorites';
import {
  addFavorite,
  createOrganization,
  createSession,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';

describe('Favorite e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('add to favorites', async () => {
    const name = faker.company.companyName();
    const org = await createOrganization(app, { name });
    await addFavorite(app, org.id);
  });

  it('remove from favorites', async () => {
    const name = faker.company.companyName();
    const org = await createOrganization(app, { name });
    await addFavorite(app, org.id);

    const result = await app.graphql.mutate(
      gql`
        mutation removeFavorite($id: ID!) {
          removeFavorite(id: $id)
        }
      `,
      {
        id: org.id,
      }
    );

    const actual: Favorite | undefined = result.removeFavorite;
    expect(actual).toBeTruthy();
    return org;
  });

  // LIST Favorites
  it('list view of favorites', async () => {
    // create a bunch of orgs
    await Promise.all(
      times(10).map(async () => {
        const org = await createOrganization(app, {
          name: generate() + ' Inc',
        });
        await addFavorite(app, org.id);
      })
    );

    const { favorites } = await app.graphql.query(gql`
      query {
        favorites(input: { filter: {} }) {
          items {
            ...fav
          }
          hasMore
          total
        }
      }
      ${fragments.fav}
    `);
    expect(favorites.items.length).toBeGreaterThan(9);
  });
});
