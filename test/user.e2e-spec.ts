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
  login,
  TestApp,
} from './utility';

describe('User e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    process.env = Object.assign(process.env, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ROOT_ADMIN_EMAIL: 'asdf@asdf.asdf',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ROOT_ADMIN_PASSWORD: 'asdf',
    });
    app = await createTestApp();
    await createSession(app);
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

    const user = await createUser(app, fakeUser);
    await login(app, { email: fakeUser.email, password: fakeUser.password });

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
    // console.log('actual ', JSON.stringify(actual, null, 2));

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
    const newUser: CreateUser = {
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
    await createSession(app);
    const user = await createUser(app, newUser);
    await login(app, { email: newUser.email, password: newUser.password });

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

  it.skip('Check consistency across user nodes', async () => {
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
