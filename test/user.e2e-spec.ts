import { faker } from '@faker-js/faker';
import { times } from 'lodash';
import { firstLettersOfWords, isValidId } from '~/common';
import { Organization } from '../src/components/organization/dto';
import { SecuredTimeZone } from '../src/components/timezone/timezone.dto';
import {
  UpdateUser,
  UpdateUserInput,
  User,
  UserStatus,
} from '../src/components/user/dto';
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
  Raw,
  registerUser,
  runInIsolatedSession,
  TestApp,
} from './utility';
import { RawUser } from './utility/fragments';

describe('User e2e', () => {
  let app: TestApp;
  let org: Raw<Organization>;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await loginAsAdmin(app);
    org = await createOrganization(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('read one user by id', async () => {
    const { password: _, ...fakeUser } = await generateRegisterInput();

    const user = await createPerson(app, fakeUser);

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
        id: user.id,
      },
    );

    const actual: RawUser & { avatarLetters: string; fullName: string } =
      result.user;
    expect(actual).toBeTruthy();

    expect(isValidId(actual.id)).toBe(true);
    expect(actual.email.value).toBe(fakeUser.email.toLowerCase());
    expect(actual.realFirstName.value).toBe(fakeUser.realFirstName);
    expect(actual.realLastName.value).toBe(fakeUser.realLastName);
    expect(actual.displayFirstName.value).toBe(fakeUser.displayFirstName);
    expect(actual.displayLastName.value).toBe(fakeUser.displayLastName);
    expect(actual.phone.value).toBe(fakeUser.phone);
    expect((actual.timezone as SecuredTimeZone).value?.name).toBe(
      fakeUser.timezone,
    );
    expect(actual.about.value).toBe(fakeUser.about);
    expect(actual.status.value).toBe(fakeUser.status);
    expect(actual.avatarLetters).toBe(firstLettersOfWords(actual.fullName));

    return true;
  });

  it('create user with required input fields', async () => {
    const { password: _, ...user } = await generateRequireFieldsRegisterInput();
    const actual = await createPerson(app, user, false);

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
    const user = await createPerson(app);

    const fakeUser: UpdateUser = {
      id: user.id,
      email: faker.internet.email(),
      realFirstName: faker.person.firstName(),
      realLastName: faker.person.lastName(),
      displayFirstName: faker.person.firstName(),
      displayLastName: faker.person.lastName(),
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
      },
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
      fakeUser.timezone,
    );
    expect(actual.about.value).toBe(fakeUser.about);
    expect(actual.status.value).toBe(fakeUser.status);

    return true;
  });

  it('delete user', async () => {
    // create user first
    const user = await createPerson(app);
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
      },
    );

    const actual: User | undefined = result.deleteUser;
    expect(actual).toBeTruthy();

    return true;
  });

  // LIST USERS
  it('list view of users', async () => {
    await Promise.all(times(4).map(() => createPerson(app)));

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
    const newUser = await createPerson(app);
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
      },
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
      },
    );
    const actual = result1.user;
    expect(actual).toBeTruthy();
    expect(actual.organizations.items[0].id).toBe(org.id);
  });

  it('remove organization from user', async () => {
    const newUser = await createPerson(app);

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
      },
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
      },
    );
  });

  it('assign primary organization to user', async () => {
    const newUser = await createPerson(app);
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
      },
    );
  });

  it('remove primary organization from user', async () => {
    const newUser = await createPerson(app);

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
      },
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
      },
    );

    // TODO after #430 is resolved, list orgs and make sure org is removed as primary
  });

  it('read one users education', async () => {
    const newUser = await createPerson(app);
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
      },
    );
    const actual = result.user;
    expect(actual).toBeTruthy();
    expect(actual.education.items[0].id).toBe(edu.id);
    return true;
  });

  it('read one users unavailability', async () => {
    const newUser = await createPerson(app);
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
      },
    );
    const actual = result.user;
    expect(actual).toBeTruthy();
    expect(actual.unavailabilities.items[0].id).toBe(unavail.id);
    return true;
  });

  it('Email is case insensitive', async () => {
    const email = faker.internet.email().toUpperCase();
    const password = faker.internet.password();

    await runInIsolatedSession(app, async () => {
      const user = await registerUser(app, { email, password });
      expect(user.email.value).toBe(email.toLowerCase());

      await login(app, { email: email.toLowerCase(), password });
      await login(app, { email, password });
    });
  });

  it('Email can be cleared', async () => {
    const person = await createPerson(app);

    const result = await app.graphql.mutate(
      gql`
        mutation updateUser($input: UpdateUserInput!) {
          updateUser(input: $input) {
            user {
              email {
                value
              }
            }
          }
        }
      `,
      {
        input: {
          user: {
            id: person.id,
            email: null,
          },
        } satisfies UpdateUserInput,
      },
    );
    expect(result.updateUser.user.email.value).toBeNull();
  });
});
