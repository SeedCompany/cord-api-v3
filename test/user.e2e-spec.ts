import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { isValid } from 'shortid';
import { RegisterInput } from '../src/components/authentication';
import { SecuredTimeZone } from '../src/components/timezone';
import { UpdateUser, User, UserStatus } from '../src/components/user';
import {
  createEducation,
  createOrganization,
  createSession,
  createTestApp,
  createUnavailability,
  createUser,
  fragments,
  generateRegisterInput,
  generateRequireFieldsRegisterInput,
  login,
  TestApp,
} from './utility';

describe('User e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    process.env = Object.assign(process.env, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ROOT_ADMIN_EMAIL: 'devops@tsco.org',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ROOT_ADMIN_PASSWORD: 'admin',
    });
    app = await createTestApp();
    await createSession(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('read one user by id', async () => {
    const fakeUser = generateRegisterInput();

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
    expect((actual.timezone as SecuredTimeZone).value?.name).toBe(
      fakeUser.timezone
    );
    expect(actual.bio.value).toBe(fakeUser.bio);
    expect(actual.status.value).toBe(fakeUser.status);

    return true;
  });

  it('create user with required input fields', async () => {
    const user: RegisterInput = {
      ...generateRequireFieldsRegisterInput(),
    };

    const result = await app.graphql.mutate(
      gql`
        mutation createUser($input: RegisterInput!) {
          register(input: $input) {
            user {
              ...user
            }
          }
        }
        ${fragments.user}
      `,
      {
        input: user,
      }
    );

    const actual: User = result.register.user;
    expect(actual).toBeTruthy();

    expect(isValid(actual.id)).toBe(true);
    expect(actual.email.value).toBe(user.email);
    expect(actual.realFirstName.value).toBe(user.realFirstName);
    expect(actual.realLastName.value).toBe(user.realLastName);
    expect(actual.displayFirstName.value).toBe(user.displayFirstName);
    expect(actual.displayLastName.value).toBe(user.displayLastName);
    expect(actual.phone.value).toBeNull();
    expect(actual.bio.value).toBeNull();
    expect(actual.status.value).toBeNull();
    expect((actual.timezone as SecuredTimeZone).value?.name).toBe(
      user.timezone
    );
  });

  it('update user', async () => {
    // create user first
    const newUser = generateRegisterInput();
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
      timezone: 'America/New_York',
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
    expect((actual.timezone as SecuredTimeZone).value?.name).toBe(
      fakeUser.timezone
    );
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
    await createUser(app);
    await createUser(app);

    await login(app, {
      email: process.env.ROOT_ADMIN_EMAIL,
      password: process.env.ROOT_ADMIN_PASSWORD,
    });

    const { users } = await app.graphql.query(gql`
      query {
        users(input: { count: 25, page: 1 }) {
          items {
            ...user
          }
          hasMore
          total
        }
      }
      ${fragments.user}
    `);

    expect(users.items.length).toBeGreaterThanOrEqual(2);
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
    const actual = result1.user;
    expect(actual).toBeTruthy();
    expect(actual.organizations.items[0].id).toBe(org.id);
    return true;
  });

  it('read one users education', async () => {
    const newUser = await createUser(app);
    const edu = await createEducation(app, { userId: newUser.id });

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
    expect(actual.education.items[0].id).toBe(edu.id);
    return true;
  });

  it('read one users unavailablity', async () => {
    const newUser = await createUser(app);
    const unavail = await createUnavailability(app, { userId: newUser.id });

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
    expect(actual.unavailabilities.items[0].id).toBe(unavail.id);
    return true;
  });

  it('read user avatar', async () => {
    const fakeUser = generateRegisterInput();
    const newUser = await createUser(app, fakeUser);

    const result = await app.graphql.query(
      gql`
        query user($id: ID!) {
          user(id: $id) {
            ...user
            avatarLetters
          }
        }
        ${fragments.user}
      `,
      {
        id: newUser.id,
      }
    );
    const actual = result.user;
    expect(actual.avatarLetters).toBe(
      `${fakeUser.realFirstName[0]}${fakeUser.realLastName[0]}`
    );
    expect(actual).toBeTruthy();
    return true;
  });

  // skipping because we will be refactoring how we do search
  it('list users with organizations', async () => {
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

    const { user } = await app.graphql.query(
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
    expect(user.organizations).toBeTruthy();
    expect(user.organizations.items.length).toBeGreaterThanOrEqual(1);
  });
});
