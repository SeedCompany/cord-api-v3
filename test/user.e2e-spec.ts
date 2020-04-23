import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { isValid } from 'shortid';
import { CreateUser, UpdateUser, User } from '../src/components/user';
import {
  createSession,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';

describe('User e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
  });

  it('check email existance', async () => {
    const email = faker.internet.email();
    const fakeUser: CreateUser = {
      email: email,
      realFirstName: faker.name.firstName(),
      realLastName: faker.name.lastName(),
      displayFirstName: faker.name.firstName(),
      displayLastName: faker.name.lastName(),
      password: faker.internet.password(),
      phone: faker.phone.phoneNumber(),
      timezone: 'timezone detail',
      bio: 'bio detail',
    };
    // create user first
    await createUser(app, fakeUser);
    const existsEmailRes = await app.graphql.query(
      gql`
        query checkEmail($email: String!) {
          checkEmail(email: $email)
        }
      `,
      {
        email: email,
      }
    );

    const nonExistentEmail = faker.internet.email();
    const nonExistentEmailRes = await app.graphql.query(
      gql`
        query checkEmail($email: String!) {
          checkEmail(email: $email)
        }
      `,
      {
        email: nonExistentEmail,
      }
    );
    expect(existsEmailRes.checkEmail).toBe(false);
    expect(nonExistentEmailRes.checkEmail).toBe(true);
  });

  it('read one user by id', async () => {
    const fakeUser: CreateUser = {
      email: faker.internet.email(),
      realFirstName: faker.name.firstName(),
      realLastName: faker.name.lastName(),
      displayFirstName: faker.name.firstName(),
      displayLastName: faker.name.lastName(),
      password: faker.internet.password(),
      phone: faker.phone.phoneNumber(),
      timezone: 'timezone detail',
      bio: 'bio detail',
    };
    // create user first
    const user = await createUser(app, fakeUser);
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
      }
    );

    const actual: User = result.user;
    expect(actual).toBeTruthy();

    expect(isValid(actual.id)).toBe(true);
    expect(actual.email.value).toBe(fakeUser.email);
    expect(actual.realFirstName.value).toBe(fakeUser.realFirstName);
    expect(actual.realLastName.value).toBe(fakeUser.realLastName);
    expect(actual.displayFirstName.value).toBe(fakeUser.displayFirstName);
    expect(actual.displayLastName.value).toBe(fakeUser.displayLastName);
    expect(actual.phone.value).toBe(fakeUser.phone);
    expect(actual.timezone.value).toBe(fakeUser.timezone);
    expect(actual.bio.value).toBe(fakeUser.bio);

    return true;
  });

  it('update user', async () => {
    // create user first
    const user = await createUser(app);
    const fakeUser: UpdateUser = {
      id: user.id,
      realFirstName: faker.name.firstName(),
      realLastName: faker.name.lastName(),
      displayFirstName: faker.name.firstName(),
      displayLastName: faker.name.lastName(),
      phone: faker.phone.phoneNumber(),
      timezone: 'new timezone detail',
      bio: 'new bio detail',
    };

    // update
    await app.graphql.mutate(
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
            ...fakeUser,
          },
        },
      }
    );
    // get the user from the ID
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
      }
    );
    const actual: User = result.user;

    expect(actual).toBeTruthy();

    expect(isValid(actual.id)).toBe(true);

    expect(actual.realFirstName.value).toBe(fakeUser.realFirstName);
    expect(actual.realLastName.value).toBe(fakeUser.realLastName);
    expect(actual.displayFirstName.value).toBe(fakeUser.displayFirstName);
    expect(actual.displayLastName.value).toBe(fakeUser.displayLastName);
    expect(actual.phone.value).toBe(fakeUser.phone);
    expect(actual.timezone.value).toBe(fakeUser.timezone);
    expect(actual.bio.value).toBe(fakeUser.bio);

    return true;
  });

  it('delete user', async () => {
    // create user first
    const user = await createUser(app);
    const result = await app.graphql.query(
      gql`
        mutation deleteUser($id: ID!) {
          deleteUser(id: $id)
        }
      `,
      {
        id: user.id,
      }
    );

    const actual: User | undefined = result.deleteUser;
    expect(actual).toBeTruthy();

    return true;
  });

  // LIST USERS
  it('list view of users', async () => {
    // create a bunch of users
    await Promise.all(
      times(10).map(() => createUser(app, { displayFirstName: 'Tammy' }))
    );

    const { users } = await app.graphql.query(gql`
      query {
        users(input: { filter: { displayFirstName: "Tammy" } }) {
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

  it('Check consistency across user nodes', async () => {
    // create a user
    const user = await createUser(app, { email: faker.internet.email() });
    // test it has proper schema
    const result = await app.graphql.query(gql`
      query {
        checkUserConsistency
      }
    `);
    expect(result.checkUserConsistency).toBeTruthy();
    // delete user node so next test will pass
    await app.graphql.mutate(
      gql`
        mutation deleteUser($id: ID!) {
          deleteUser(id: $id)
        }
      `,
      {
        id: user.id,
      }
    );
  });

  afterAll(async () => {
    await app.close();
  });
});
