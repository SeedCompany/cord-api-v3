import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate } from 'shortid';
import { BaseNode, Favorite } from '../src/components/favorites';
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

  // ADD FAVORITE
  it('add to favorites', async () => {
    const name = faker.company.companyName();
    const org = await createOrganization(app, { name });
    await addFavorite(app, org.id);
  });

  // REMOVE FROM FAVORITE
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

  // LIST FAVORITES
  it('list view of favorites', async () => {
    // create a bunch of orgs
    const numOrgs = 2;
    await Promise.all(
      times(numOrgs).map(async () => {
        const org = await createOrganization(app, {
          name: generate() + ' Inc',
        });
        await addFavorite(app, org.id);
      })
    );
    const baseNode = BaseNode.Organization;

    const { favorites } = await app.graphql.query(
      gql`
        query favorites($baseNode: BaseNode!) {
          favorites(input: { filter: { baseNode: $baseNode } }) {
            items {
              ...fav
            }
            hasMore
            total
          }
        }
        ${fragments.fav}
      `,
      {
        baseNode,
      }
    );
    expect(favorites.items.length).toBeGreaterThanOrEqual(numOrgs);
  });
});
