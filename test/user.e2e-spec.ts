import { faker } from '@faker-js/faker';
import { firstLettersOfWords, isValidId } from '../src/common';
import { Role } from '../src/components/authorization';
import { SecuredTimeZone } from '../src/components/timezone';
import { UpdateUser, User, UserStatus } from '../src/components/user';
import {
  createEducation,
  createOrganization,
  createPerson,
  createSession,
  createTestApp,
  createUnavailability,
  fragments,
  generateRegisterInput,
  generateRequireFieldsRegisterInput,
  gql,
  login,
  loginAsAdmin,
  registerUser,
  registerUserWithStrictInput,
  TestApp,
} from './utility';

describe('User e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('read one user by id', async () => {
    const fakeUser = await generateRegisterInput();

    const user = await registerUser(app, fakeUser);

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

    expect(isValidId(actual.id)).toBe(true);
    expect(actual.email.value).toBe(fakeUser.email.toLowerCase());
    expect(actual.realFirstName.value).toBe(fakeUser.realFirstName);
    expect(actual.realLastName.value).toBe(fakeUser.realLastName);
    expect(actual.displayFirstName.value).toBe(fakeUser.displayFirstName);
    expect(actual.displayLastName.value).toBe(fakeUser.displayLastName);
    expect(actual.phone.value).toBe(fakeUser.phone);
    expect((actual.timezone as SecuredTimeZone).value?.name).toBe(
      fakeUser.timezone
    );
    expect(actual.about.value).toBe(fakeUser.about);
    expect(actual.status.value).toBe(fakeUser.status);

    return true;
  });

  it('create user with required input fields', async () => {
    const user = await generateRequireFieldsRegisterInput();
    const actual = await registerUserWithStrictInput(app, user);

    expect(isValidId(actual.id)).toBe(true);
    expect(actual.email.value).toBe(user.email.toLowerCase());
    expect(actual.realFirstName.value).toBe(user.realFirstName);
    expect(actual.realLastName.value).toBe(user.realLastName);
    expect(actual.displayFirstName.value).toBe(user.displayFirstName);
    expect(actual.displayLastName.value).toBe(user.displayLastName);
    expect(actual.phone.value).toBeNull();
    expect(actual.about.value).toBeNull();
    expect(actual.status.value).toBeNull();
    expect(actual.timezone.value?.name).toBe(user.timezone);
  });

  it('update user', async () => {
    // create user first
    const user = await registerUser(app);

    const fakeUser: UpdateUser = {
      id: user.id,
      email: faker.internet.email(),
      realFirstName: faker.name.firstName(),
      realLastName: faker.name.lastName(),
      displayFirstName: faker.name.firstName(),
      displayLastName: faker.name.lastName(),
      phone: faker.phone.number(),
      timezone: 'America/New_York',
      about: 'new about detail',
      status: UserStatus.Disabled,
    };

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
            ...fakeUser,
          },
        },
      }
    );
    const actual: User = result.updateUser.user;

    expect(actual).toBeTruthy();

    expect(isValidId(actual.id)).toBe(true);

    expect(actual.email.value).toBe(fakeUser.email?.toLowerCase());
    expect(actual.realFirstName.value).toBe(fakeUser.realFirstName);
    expect(actual.realLastName.value).toBe(fakeUser.realLastName);
    expect(actual.displayFirstName.value).toBe(fakeUser.displayFirstName);
    expect(actual.displayLastName.value).toBe(fakeUser.displayLastName);
    expect(actual.phone.value).toBe(fakeUser.phone);
    expect((actual.timezone as SecuredTimeZone).value?.name).toBe(
      fakeUser.timezone
    );
    expect(actual.about.value).toBe(fakeUser.about);
    expect(actual.status.value).toBe(fakeUser.status);

    return true;
  });

  it('delete user', async () => {
    // create user first
    const user = await registerUser(app);
    const result = await app.graphql.query(
      gql`
        mutation deleteUser($id: ID!) {
          deleteUser(id: $id) {
            __typename
          }
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
    await registerUser(app);
    await registerUser(app);
    await registerUser(app);
    await registerUser(app);

    await loginAsAdmin(app);

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

  it('assign organization to user', async () => {
    const newUser = await registerUser(app, {
      roles: [Role.FieldOperationsDirector, Role.LeadFinancialAnalyst],
    });
    const org = await createOrganization(app);
    await app.graphql.mutate(
      gql`
        mutation assignOrganizationToUser($orgId: ID!, $userId: ID!) {
          assignOrganizationToUser(
            input: { request: { orgId: $orgId, userId: $userId } }
          ) {
            __typename
          }
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
      }
    );
  });

  it('remove organization from user', async () => {
    const newUser = await registerUser(app, {
      roles: [Role.FieldOperationsDirector, Role.LeadFinancialAnalyst],
    });
    const org = await createOrganization(app);

    // assign organization to user
    await app.graphql.mutate(
      gql`
        mutation assignOrganizationToUser($orgId: ID!, $userId: ID!) {
          assignOrganizationToUser(
            input: { request: { orgId: $orgId, userId: $userId } }
          ) {
            __typename
          }
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
      }
    );

    // remove organization from user
    await app.graphql.mutate(
      gql`
        mutation removeOrganizationFromUser($orgId: ID!, $userId: ID!) {
          removeOrganizationFromUser(
            input: { request: { orgId: $orgId, userId: $userId } }
          ) {
            __typename
          }
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
      }
    );
  });

  it('assign primary organization to user', async () => {
    const newUser = await registerUser(app, {
      roles: [Role.FieldOperationsDirector, Role.LeadFinancialAnalyst],
    });
    const org = await createOrganization(app);
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
          ) {
            __typename
          }
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
        primary: true,
      }
    );
  });

  it('remove primary organization from user', async () => {
    const newUser = await registerUser(app, {
      roles: [Role.FieldOperationsDirector, Role.LeadFinancialAnalyst],
    });
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
          ) {
            __typename
          }
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
        primary: true,
      }
    );

    // remove primary organization from user
    await app.graphql.mutate(
      gql`
        mutation removeOrganizationFromUser($orgId: ID!, $userId: ID!) {
          removeOrganizationFromUser(
            input: { request: { orgId: $orgId, userId: $userId } }
          ) {
            __typename
          }
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
      }
    );

    // TODO after #430 is resolved, list orgs and make sure org is removed as primary
  });

  it('read one users organizations', async () => {
    const newUser = await registerUser(app, {
      roles: [Role.FieldOperationsDirector, Role.LeadFinancialAnalyst],
    });

    const org = await createOrganization(app);
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
          ) {
            __typename
          }
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
        primary: true,
      }
    );

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
    const newUser = await registerUser(app);
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
    const newUser = await registerUser(app, {
      roles: [Role.FieldOperationsDirector],
    });
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
    const fakeUser = await generateRegisterInput();
    const newUser = await registerUser(app, fakeUser);

    const result = await app.graphql.query(
      gql`
        query user($id: ID!) {
          user(id: $id) {
            ...user
            avatarLetters
            fullName
          }
        }
        ${fragments.user}
      `,
      {
        id: newUser.id,
      }
    );
    const actual = result.user;
    expect(actual.avatarLetters).toBe(firstLettersOfWords(actual.fullName));
  });

  it('list users with organizations', async () => {
    const newUser = await registerUser(app, {
      roles: [Role.FieldOperationsDirector, Role.LeadFinancialAnalyst],
    });
    const org = await createOrganization(app);

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
          ) {
            __typename
          }
        }
      `,
      {
        orgId: org.id,
        userId: newUser.id,
        primary: true,
      }
    );

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

  it('should test Email is not case sensitive', async () => {
    const email = faker.internet.email().toUpperCase();
    const password = faker.internet.password(10);
    const user = await registerUser(app, { email, password });
    expect(user.email.value).toBe(email.toLowerCase());

    await login(app, { email: email.toLowerCase(), password });
    await login(app, { email, password });
  });

  it('create person - optional email', async () => {
    await registerUser(app);

    const person = await createPerson(app, {
      email: undefined,
    });
    expect(person.email.value).toBeNull();
  });
});
