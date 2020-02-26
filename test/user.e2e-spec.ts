import { User } from '../src/components/user';
import {
  TestApp,
  createTestApp,
  createSession,
  createUser,
  fragments,
} from './utility';
import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import { times } from 'lodash';

describe('User e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('read one user by id', async () => {
    // create user first
    const token = await createSession(app);
    const user = await createUser(app);
    const result = await app.graphql.query(
      gql`
        query user($id: ID!) {
          user(id: $id) {
            ...user
          }
        }
        ${fragments.user}
      `,
      {
        id: user.id,
      },
    );

    const actual: User = result.user;
    expect(actual).toBeTruthy();

    expect(isValid(actual.id)).toBe(true);
    expect(actual.email.value).toBe(user.email.value);

    return true;
  });

  it('update user', async () => {
    // create user first
    const token = await createSession(app);
    const user = await createUser(app);
    const result = await app.graphql.mutate(
      gql`
        mutation updateUser($input: UpdateUserInput!) {
          updateUser(input: $input) {
            user {
              ...user
            }
          }
        }
        ${fragments.user}
      `,
      {
        input: {
          user: {
            id: user.id,
            realFirstName: user.realFirstName.value + ' 2',
          },
        },
      },
    );

    const actual: User = result.updateUser.user;
    expect(actual).toBeTruthy();

    expect(isValid(actual.id)).toBe(true);
    expect(actual.email.value).toBe(user.email.value);

    return true;
  });

  it('delete user', async () => {
    // create user first
    const token = await createSession(app);
    const user = await createUser(app);
    const result = await app.graphql.query(
      gql`
        mutation deleteUser($id: ID!) {
          deleteUser(id: $id)
        }
      `,
      {
        id: user.id,
      },
    );

    const actual: User | undefined = result.deleteUser;
    expect(actual).toBeTruthy();

    return true;
  });

  // LIST USERS
  it('list view of users', async () => {
    // create a bunch of users
    await Promise.all(times(10).map(() => createUser(app)));

    const { users } = await app.graphql.query(gql`
      query {
        users {
          items {
            ...user
          }
          hasMore
          total
        }
      }
      ${fragments.user}
    `);

    expect(users.items.length).toBeGreaterThan(9);
  });

  afterAll(async () => {
    await app.close();
  });
});
