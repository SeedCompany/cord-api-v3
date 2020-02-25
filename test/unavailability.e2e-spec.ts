import * as faker from 'faker';

import {
  TestApp,
  createSession,
  createTestApp,
  createUnavailability,
  createUser,
} from './utility';

import { Unavailability } from '../src/components/user/unavailability';
import { User } from '../src/components/user';
import { fragments } from './utility';
import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import { times } from 'lodash';

describe('Unavailability e2e', () => {
  let app: TestApp;
  let user: User;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
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
      fail();
    }
  });

  // UPDATE LANGUAGE
  it('update unavailability', async () => {
    const unavailability = await createUnavailability(app, { userId: user.id });
    const newDesc = faker.company.companyName();

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
            description: newDesc,
          },
        },
      },
    );
    const updated = result?.updateUnavailability?.unavailability;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(unavailability.id);
    expect(updated.description.value).toBe(newDesc);
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
      fail();
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
