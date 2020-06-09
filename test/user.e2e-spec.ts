import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { isValid } from 'shortid';
import {
  CreateUser,
  UpdateUser,
  User,
  UserStatus,
} from '../src/components/user';
import {
  createEducation,
  createOrganization,
  createSession,
  createTestApp,
  createUnavailability,
  createUser,
  fragments,
  login,
  TestApp,
} from './utility';

jest.setTimeout(60_000 * 30);

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

  afterAll(async () => {
    await app.close();
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
      status: UserStatus.Active,
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
    expect(actual.status.value).toBe(fakeUser.status);

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
      status: UserStatus.Active,
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
      status: UserStatus.Disabled,
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
    expect(actual.status.value).toBe(fakeUser.status);

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

  it('assign organization to user', async () => {
    const newUser = await createUser(app);
    const org = await createOrganization(app);
    const result = await app.graphql.mutate(
      gql`
        mutation assignOrganizationToUser($orgId: ID!, $userId: ID!) {
          assignOrganizationToUser(
            input: { request: { orgId: $orgId, userId: $userId } }
          )
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
      }
    );

    expect(result.assignOrganizationToUser).toBe(true);
  });

  it('remove organization from user', async () => {
    const newUser = await createUser(app);
    const org = await createOrganization(app);

    // assign organization to user
    await app.graphql.mutate(
      gql`
        mutation assignOrganizationToUser($orgId: ID!, $userId: ID!) {
          assignOrganizationToUser(
            input: { request: { orgId: $orgId, userId: $userId } }
          )
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
      }
    );

    // remove organization from user
    const result = await app.graphql.mutate(
      gql`
        mutation removeOrganizationFromUser($orgId: ID!, $userId: ID!) {
          removeOrganizationFromUser(
            input: { request: { orgId: $orgId, userId: $userId } }
          )
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
      }
    );

    expect(result.removeOrganizationFromUser).toBe(true);
  });

  it('assign primary organization to user', async () => {
    const newUser = await createUser(app);
    const org = await createOrganization(app);
    const result = await app.graphql.mutate(
      gql`
        mutation assignOrganizationToUser(
          $orgId: ID!
          $userId: ID!
          $primary: Boolean!
        ) {
          assignOrganizationToUser(
            input: {
              request: { orgId: $orgId, userId: $userId, primary: $primary }
            }
          )
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
        primary: true,
      }
    );

    expect(result.assignOrganizationToUser).toBe(true);
  });

  it('remove primary organization from user', async () => {
    const newUser = await createUser(app);
    const org = await createOrganization(app);

    // assign primary organization to user
    await app.graphql.mutate(
      gql`
        mutation assignOrganizationToUser(
          $orgId: ID!
          $userId: ID!
          $primary: Boolean!
        ) {
          assignOrganizationToUser(
            input: {
              request: { orgId: $orgId, userId: $userId, primary: $primary }
            }
          )
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
        primary: true,
      }
    );

    // remove primary organization from user
    const result = await app.graphql.mutate(
      gql`
        mutation removeOrganizationFromUser($orgId: ID!, $userId: ID!) {
          removeOrganizationFromUser(
            input: { request: { orgId: $orgId, userId: $userId } }
          )
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
      }
    );

    expect(result.removeOrganizationFromUser).toBe(true);

    // TODO after #430 is resolved, list orgs and make sure org is removed as primary
  });

  it('read one users organizations', async () => {
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
      status: UserStatus.Active,
    };
    const newUser = await createUser(app, fakeUser);
    const org = await createOrganization(app);

    const result = await app.graphql.mutate(
      gql`
        mutation assignOrganizationToUser(
          $orgId: ID!
          $userId: ID!
          $primary: Boolean!
        ) {
          assignOrganizationToUser(
            input: {
              request: { orgId: $orgId, userId: $userId, primary: $primary }
            }
          )
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
        primary: true,
      }
    );

    expect(result.assignOrganizationToUser).toBe(true);

    const result1 = await app.graphql.query(
      gql`
        query user($id: ID!) {
          user(id: $id) {
            ...user
            organizations {
              items {
                ...org
              }
              hasMore
              total
              canRead
              canCreate
            }
          }
        }
        ${fragments.user}
        ${fragments.org}
      `,
      {
        id: newUser.id,
      }
    );
    const actual: User = result1.user;
    expect(actual).toBeTruthy();
    return true;
  });

  it('read one users education', async () => {
    const newUser = await createUser(app);
    await createEducation(app, { userId: newUser.id });

    const result = await app.graphql.query(
      gql`
        query user($id: ID!) {
          user(id: $id) {
            ...user
            education {
              items {
                ...education
              }
              hasMore
              total
              canRead
              canCreate
            }
          }
        }
        ${fragments.user}
        ${fragments.education}
      `,
      {
        id: newUser.id,
      }
    );
    const actual = result.user;
    expect(actual).toBeTruthy();
    return true;
  });

  it('read one users unavailablity', async () => {
    const newUser = await createUser(app);
    await createUnavailability(app, { userId: newUser.id });

    const result = await app.graphql.query(
      gql`
        query user($id: ID!) {
          user(id: $id) {
            ...user
            unavailabilities {
              items {
                ...unavailability
              }
              hasMore
              total
              canRead
              canCreate
            }
          }
        }
        ${fragments.user}
        ${fragments.unavailability}
      `,
      {
        id: newUser.id,
      }
    );
    const actual = result.user;
    expect(actual).toBeTruthy();
    return true;
  });
});
