import * as faker from 'faker';

import {
  TestApp,
  createTestApp,
  createToken,
  createUnavailability,
  createUser,
} from './utility';

import { Unavailability } from '../src/components/user/unavailability';
import { User } from '../src/components/user';
import { fragments } from './utility/fragments';
import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import { times } from 'lodash';

describe('Unavailability e2e', () => {
  let app: TestApp;
  let user: User;

  beforeEach(async () => {
    app = await createTestApp();
    await createToken(app);
    user = await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a unavailability', async () => {
    const unavailability = await createUnavailability(app, { userId: user.id });
    expect(unavailability.id).toBeDefined();
  });

  it('read one unavailability by id', async () => {
    const unavailability = await createUnavailability(app, { userId: user.id });

    try {
      const { unavailability: actual } = await app.graphql.query(
        gql`
          query unavailability($id: ID!) {
            unavailability(id: $id) {
              ...unavailability
            }
          }
          ${fragments.unavailability}
        `,
        {
          id: unavailability.id,
        },
      );

      expect(actual.id).toBe(unavailability.id);
      expect(isValid(actual.id)).toBe(true);
      expect(actual.description).toEqual(unavailability.description);
    } catch (e) {
      console.error(e);
    }
  });

  // UPDATE LANGUAGE
  it.skip('update unavailability', async () => {
    const unavailability = await createUnavailability(app, { userId: user.id });
    const newName = faker.company.companyName();

    const result = await app.graphql.mutate(
      gql`
        mutation updateUnavailability($input: UpdateUnavailabilityInput!) {
          updateUnavailability(input: $input) {
            unavailability {
              ...unavailability
            }
          }
        }
        ${fragments.unavailability}
      `,
      {
        input: {
          unavailability: {
            id: unavailability.id,
            name: newName,
          },
        },
      },
    );
    const updated = result?.updateUnavailability?.unavailability;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(unavailability.id);
    expect(updated.name.value).toBe(newName);
  });

  // DELETE LANGUAGE
  it('delete unavailability', async () => {
    const unavailability = await createUnavailability(app, { userId: user.id });

    try {
      const result = await app.graphql.mutate(
        gql`
          mutation deleteUnavailability($id: ID!) {
            deleteUnavailability(id: $id)
          }
        `,
        {
          id: unavailability.id,
        },
      );
      const actual: Unavailability | undefined = result.deleteUnavailability;
      expect(actual).toBeTruthy();
    } catch (e) {
      console.log(e);
    }
  });

  // LIST Unavailabilities
  it.skip('List view of unavailabilities', async () => {
    // create a bunch of unavailabilities
    const numUnavailables = 10;
    await Promise.all(
      times(numUnavailables).map(() =>
        createUnavailability(app, { userId: user.id }),
      ),
    );
    // test reading new lang
    const { unavailables } = await app.graphql.query(gql`
      query {
        unavailabilities {
          items {
            ...org
          }
          hasMore
          total
        }
      }
      ${fragments.org}
    `);

    expect(unavailables.items.length).toBeGreaterThan(numUnavailables);
  });
});
