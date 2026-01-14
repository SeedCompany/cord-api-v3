import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { times } from 'lodash';
import { isValidId, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createSession,
  createTestApp,
  createUnavailability,
  fragments,
  registerUser,
  type TestApp,
} from './utility';

describe('Unavailability e2e', () => {
  let app: TestApp;
  let user: fragments.user;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    user = await registerUser(app, { roles: [Role.FieldOperationsDirector] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a unavailability', async () => {
    const unavailability = await createUnavailability(app, { user: user.id });
    expect(unavailability.id).toBeDefined();
  });

  it('read one unavailability by id', async () => {
    const unavailability = await createUnavailability(app, { user: user.id });

    const { unavailability: actual } = await app.graphql.query(
      graphql(
        `
          query unavailability($id: ID!) {
            unavailability(id: $id) {
              ...unavailability
            }
          }
        `,
        [fragments.unavailability],
      ),
      {
        id: unavailability.id,
      },
    );

    expect(actual.id).toBe(unavailability.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.description).toEqual(unavailability.description);
  });

  // UPDATE UNAVAILABILITY
  it('update unavailability', async () => {
    const unavailability = await createUnavailability(app, { user: user.id });
    const newDesc = faker.company.name();

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateUnavailability($input: UpdateUnavailabilityInput!) {
            updateUnavailability(input: $input) {
              unavailability {
                ...unavailability
              }
            }
          }
        `,
        [fragments.unavailability],
      ),
      {
        input: {
          unavailability: {
            id: unavailability.id,
            description: newDesc,
          },
        },
      },
    );
    const updated = result.updateUnavailability.unavailability;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(unavailability.id);
    expect(updated.description.value).toBe(newDesc);
  });

  // DELETE UNAVAILABILITY
  it.skip('delete unavailability', async () => {
    const unavailability = await createUnavailability(app, { user: user.id });

    const result = await app.graphql.mutate(
      graphql(`
        mutation deleteUnavailability($id: ID!) {
          deleteUnavailability(id: $id) {
            __typename
          }
        }
      `),
      {
        id: unavailability.id,
      },
    );
    const actual = result.deleteUnavailability;
    expect(actual).toBeTruthy();
  });

  it('List view of unavailabilities', async () => {
    // create 2 unavailabilities
    const numUnavail = 2;
    await Promise.all(
      times(numUnavail).map(() => createUnavailability(app, { user: user.id })),
    );

    const result = await app.graphql.query(
      graphql(
        `
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
        `,
        [fragments.unavailability],
      ),
      {
        id: user.id,
      },
    );

    expect(result.user.unavailabilities.items.length).toBeGreaterThanOrEqual(
      numUnavail,
    );
  });
});
