import * as request from 'supertest';
import { gql } from 'apollo-server-core';
import { createTestApp, createToken, createUser, TestApp } from './utility';
import { fragments } from './utility/fragments';
import { CreateUser, User } from '../src/components/user';
import { isValid } from 'shortid';

describe('User e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it('read one user by id', async () => {
    // create user first
    const token = await createToken(app);
    const user = await createUser(app);
    const result = await app.graphql.query(
      gql`
        query user($id: ID!){
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

    const actual: User | undefined = result.user;
    expect(actual).toBeTruthy();

    expect(isValid(actual.id)).toBe(true);
    expect(actual.email.value).toBe(user.email.value);

    return true;
  });

  it('update user', async () => {
    // create user first
    const token = await createToken(app);
    const user = await createUser(app);
    const result = await app.graphql.query(
      gql`
        mutation updateUser($id: ID!, $realFirstName: String) {
          updateUser(
            input: { user: { id: $id, realFirstName: $realFirstName } }
          ) {
            user {
              ...user
            }
          }
        }
        ${fragments.user}
      `,
      {
        id: user.id,
        realFirstName: user.realFirstName.value + ' 2',
      },
    );

    const actual: User | undefined = result.updateUser.user;
    expect(actual).toBeTruthy();

    expect(isValid(actual.id)).toBe(true);
    expect(actual.email.value).toBe(user.email.value);

    return true;
  });

  it('delete user', async () => {
    // create user first
    const token = await createToken(app);
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

  afterAll(async () => {
    await app.close();
  });
});
