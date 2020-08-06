import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { isValid } from 'shortid';
import { User } from '../src/components/user';
import { Unavailability } from '../src/components/user/unavailability';
import {
  createSession,
  createTestApp,
  createUnavailability,
  createUser,
  TestApp,
} from './utility';
import { fragments } from './utility/fragments';

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
      }
    );

    expect(actual.id).toBe(unavailability.id);
    expect(isValid(actual.id)).toBe(true);
    expect(actual.description).toEqual(unavailability.description);
  });

  // UPDATE UNAVAILABILITY
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
      }
    );
    const updated = result.updateUnavailability.unavailability;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(unavailability.id);
    expect(updated.description.value).toBe(newDesc);
  });

  // DELETE UNAVAILABILITY
  it('delete unavailability', async () => {
    const unavailability = await createUnavailability(app, { userId: user.id });

    const result = await app.graphql.mutate(
      gql`
        mutation deleteUnavailability($id: ID!) {
          deleteUnavailability(id: $id)
        }
      `,
      {
        id: unavailability.id,
      }
    );
    const actual: Unavailability | undefined = result.deleteUnavailability;
    expect(actual).toBeTruthy();
  });

  it('List view of unavailabilities', async () => {
    // create 2 unavailabilities
    const numUnavail = 2;
    await Promise.all(
      times(numUnavail).map(() =>
        createUnavailability(app, { userId: user.id })
      )
    );

    const result = await app.graphql.query(
      gql`
        query UsersUnavailabilities($id: ID!) {
          user(id: $id) {
            unavailabilities {
              items {
                ...unavailability
              }
              hasMore
              total
            }
          }
        }
        ${fragments.unavailability}
      `,
      {
        id: user.id,
      }
    );

    expect(result.user.unavailabilities.items.length).toBeGreaterThanOrEqual(
      numUnavail
    );
  });

  it('Check consistency across unavailability nodes', async () => {
    // create an unavailability
    const unavailability = await createUnavailability(app, { userId: user.id });
    // test it has proper schema
    const result = await app.graphql.query(gql`
      query {
        checkUnavailabilityConsistency
      }
    `);
    expect(result.checkUnavailabilityConsistency).toBeTruthy();
    // delete unavailability node so next test will pass
    await app.graphql.mutate(
      gql`
        mutation deleteUnavailability($id: ID!) {
          deleteUnavailability(id: $id)
        }
      `,
      {
        id: unavailability.id,
      }
    );
  });
});
