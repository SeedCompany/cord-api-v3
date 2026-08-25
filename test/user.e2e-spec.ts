import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { times } from 'lodash';
import { firstLettersOfWords, generateId, isValidId } from '~/common';
import { ConfigService } from '~/core/config';
import { DrizzleService } from '~/core/drizzle';
import { users } from '~/core/drizzle/schema';
import { graphql, type InputOf, type VariablesOf } from '~/graphql';
import { UserStatus } from '../src/components/user/dto';
import {
  createLocation,
  createOrganization,
  createPerson,
  createSession,
  createTestApp,
  createUnavailability,
  errors,
  fragments,
  generateRegisterInput,
  generateRequireFieldsRegisterInput,
  login,
  loginAsAdmin,
  registerUser,
  runInIsolatedSession,
  type TestApp,
} from './utility';

describe('User e2e', () => {
  let app: TestApp;
  let org: fragments.org;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await loginAsAdmin(app);
    org = await createOrganization(app);
  });

  it('read one user by id', async () => {
    const { password: _, ...fakeUser } = await generateRegisterInput();

    const user = await createPerson(app, fakeUser);

    const result = await app.graphql.query(
      graphql(
        `
          query user($id: ID!) {
            user(id: $id) {
              ...user
              avatarLetters
              fullName
            }
          }
        `,
        [fragments.user],
      ),
      {
        id: user.id,
      },
    );

    const actual = result.user;
    expect(actual).toBeTruthy();

    expect(isValidId(actual.id)).toBe(true);
    expect(actual.email.value).toBe(fakeUser.email.toLowerCase());
    expect(actual.realFirstName.value).toBe(fakeUser.realFirstName);
    expect(actual.realLastName.value).toBe(fakeUser.realLastName);
    expect(actual.displayFirstName.value).toBe(fakeUser.displayFirstName);
    expect(actual.displayLastName.value).toBe(fakeUser.displayLastName);
    expect(actual.phone.value).toBe(fakeUser.phone);
    expect(actual.timezone.value?.name).toBe(fakeUser.timezone);
    expect(actual.about.value).toBe(fakeUser.about);
    expect(actual.status.value).toBe(fakeUser.status);
    expect(actual.avatarLetters).toBe(firstLettersOfWords(actual.fullName!));

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
    expect(actual.status.value).toBe(UserStatus.Active);
    expect(actual.timezone.value?.name).toBe(user.timezone);
  });

  it('update user', async () => {
    // create user first
    const user = await createPerson(app);

    const fakeUser: InputOf<typeof UpdateUserDoc> = {
      id: user.id,
      email: faker.internet.email(),
      realFirstName: faker.person.firstName(),
      realLastName: faker.person.lastName(),
      displayFirstName: faker.person.firstName(),
      displayLastName: faker.person.lastName(),
      phone: faker.phone.number(),
      timezone: 'America/New_York',
      about: 'new about detail',
      status: 'Disabled',
    };
    const UpdateUserDoc = graphql(
      `
        mutation updateUser($input: UpdateUser!) {
          updateUser(input: $input) {
            user {
              ...user
            }
          }
        }
      `,
      [fragments.user],
    );
    const result = await app.graphql.mutate(UpdateUserDoc, {
      input: fakeUser,
    });
    const actual = result.updateUser.user;

    expect(actual).toBeTruthy();

    expect(isValidId(actual.id)).toBe(true);

    expect(actual.email.value).toBe(fakeUser.email?.toLowerCase());
    expect(actual.realFirstName.value).toBe(fakeUser.realFirstName);
    expect(actual.realLastName.value).toBe(fakeUser.realLastName);
    expect(actual.displayFirstName.value).toBe(fakeUser.displayFirstName);
    expect(actual.displayLastName.value).toBe(fakeUser.displayLastName);
    expect(actual.phone.value).toBe(fakeUser.phone);
    expect(actual.timezone.value?.name).toBe(fakeUser.timezone);
    expect(actual.about.value).toBe(fakeUser.about);
    expect(actual.status.value).toBe(fakeUser.status);

    return true;
  });

  it('delete user', async () => {
    // create user first
    const user = await createPerson(app);
    const result = await app.graphql.query(
      graphql(`
        mutation deleteUser($id: ID!) {
          deleteUser(id: $id) {
            __typename
          }
        }
      `),
      {
        id: user.id,
      },
    );

    const actual = result.deleteUser;
    expect(actual).toBeTruthy();

    return true;
  });

  it('rejects a non-admin from deleting another user', async () => {
    const target = await createPerson(app);

    await runInIsolatedSession(app, async () => {
      await registerUser(app); // defaults to ProjectManager + Consultant, neither admin

      await expect(
        app.graphql.mutate(
          graphql(`
            mutation deleteUser($id: ID!) {
              deleteUser(id: $id) {
                __typename
              }
            }
          `),
          { id: target.id },
        ),
      ).rejects.toThrowGqlError(
        errors.unauthorized({
          message: 'You do not have the permission to delete this user',
        }),
      );
    });
  });

  // LIST USERS
  it('list view of users', async () => {
    await Promise.all(times(4).map(() => createPerson(app)));

    const { users } = await app.graphql.query(
      graphql(
        `
          query {
            users(input: { count: 25, page: 1 }) {
              items {
                ...user
              }
              hasMore
              total
            }
          }
        `,
        [fragments.user],
      ),
    );

    expect(users.items.length).toBeGreaterThanOrEqual(2);
  });

  it('leaves the anonymous system user out of the people list', async () => {
    // Un-gated on purpose: the anonymous record exists on both engines in a
    // real deployment, and the point is that they agree about hiding it.
    // Postgres used to list it — shadow-diff caught it as a one-row total
    // difference against the production copy (2,376 vs 2,375), easy to dismiss
    // as rounding until you notice it is a nameless system account sitting on
    // the People page.
    const anonId = app.get(ConfigService).anonUser.id;

    // Seeded here on Postgres, and this is the whole reason the test is worth
    // writing carefully. Neo4j's admin bootstrap creates the anonymous user
    // (AdminService.mergeAnonUser); the Drizzle one does not, so a fresh
    // Postgres database has no such row and an assertion about it would pass
    // no matter what the repository did. The first version of this test did
    // exactly that — it still passed with the exclusion commented out. In a
    // real cutover the row arrives via the ETL, so seeding it reproduces the
    // deployed state rather than inventing one.
    if (process.env.DATABASE === 'postgres') {
      await app
        .get(DrizzleService)
        .client.insert(users)
        .values({ id: anonId, status: 'Active' })
        .onConflictDoNothing();
    }

    const { users: listed } = await app.graphql.query(
      graphql(`
        query {
          users(input: { count: 100, page: 1 }) {
            items {
              id
            }
            total
          }
        }
      `),
    );

    // Both halves matter. Without the second this passes just as happily on an
    // empty list, which is the failure mode that made the first version useless.
    expect(listed.items.map((user) => user.id)).not.toContain(anonId);
    expect(listed.items.length).toBeGreaterThan(0);
  });

  it('adds and removes a location from a user', async () => {
    const user = await createPerson(app);
    const location = await createLocation(app);

    const UserLocations = graphql(`
      query user($id: ID!) {
        user(id: $id) {
          locations {
            items {
              id
            }
          }
        }
      }
    `);

    await app.graphql.mutate(
      graphql(`
        mutation addLocationToUser($user: ID!, $location: ID!) {
          addLocationToUser(user: $user, location: $location) {
            user {
              id
            }
          }
        }
      `),
      { user: user.id, location: location.id },
    );

    const afterAdd = await app.graphql.query(UserLocations, { id: user.id });
    expect(afterAdd.user.locations.items.map((l) => l.id)).toEqual([
      location.id,
    ]);

    await app.graphql.mutate(
      graphql(`
        mutation removeLocationFromUser($user: ID!, $location: ID!) {
          removeLocationFromUser(user: $user, location: $location) {
            user {
              id
            }
          }
        }
      `),
      { user: user.id, location: location.id },
    );

    const afterRemove = await app.graphql.query(UserLocations, {
      id: user.id,
    });
    expect(afterRemove.user.locations.items).toHaveLength(0);
  });

  it('lists users sorted by full name by default', async () => {
    const prefix = 'ZzzSortTest' + (await generateId());
    await createPerson(app, {
      realFirstName: `${prefix}_Charlie`,
      realLastName: 'Smith',
    });
    await createPerson(app, {
      realFirstName: `${prefix}_Alice`,
      realLastName: 'Smith',
    });
    // Same first name, different last names — verifies fullName sorting
    // breaks ties on last name instead of stopping at first name.
    await createPerson(app, {
      realFirstName: `${prefix}_Bob`,
      realLastName: 'Young',
    });
    await createPerson(app, {
      realFirstName: `${prefix}_Bob`,
      realLastName: 'Adams',
    });

    const { users } = await app.graphql.query(
      graphql(`
        query ($prefix: String!) {
          users(input: { count: 25, page: 1, filter: { name: $prefix } }) {
            items {
              realFirstName {
                value
              }
              realLastName {
                value
              }
            }
          }
        }
      `),
      { prefix },
    );

    expect(
      users.items.map(
        (user) => `${user.realFirstName.value!} ${user.realLastName.value!}`,
      ),
    ).toEqual([
      `${prefix}_Alice Smith`,
      `${prefix}_Bob Adams`,
      `${prefix}_Bob Young`,
      `${prefix}_Charlie Smith`,
    ]);
  });

  it('assign organization to user', async () => {
    const newUser = await createPerson(app);
    await assignOrganizationToUser(app, {
      org: org.id,
      user: newUser.id,
    });

    const result1 = await app.graphql.query(
      graphql(
        `
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
        `,
        [fragments.user, fragments.org],
      ),
      {
        id: newUser.id,
      },
    );
    const actual = result1.user;
    expect(actual).toBeTruthy();
    expect(actual.organizations.items[0]!.id).toBe(org.id);
  });

  it('remove organization from user', async () => {
    const newUser = await createPerson(app);

    // assign organization to user
    await assignOrganizationToUser(app, {
      org: org.id,
      user: newUser.id,
    });

    // remove organization from user
    await removeOrganizationFromUser(app, {
      org: org.id,
      user: newUser.id,
    });
  });

  it('assign primary organization to user', async () => {
    const newUser = await createPerson(app);
    await assignOrganizationToUser(app, {
      org: org.id,
      user: newUser.id,
      primary: true,
    });
  });

  it('remove primary organization from user', async () => {
    const newUser = await createPerson(app);

    // assign primary organization to user
    await assignOrganizationToUser(app, {
      org: org.id,
      user: newUser.id,
      primary: true,
    });

    // remove primary organization from user
    await removeOrganizationFromUser(app, {
      org: org.id,
      user: newUser.id,
    });

    // TODO after #430 is resolved, list orgs and make sure org is removed as primary
  });

  it('read one users unavailability', async () => {
    const newUser = await createPerson(app);
    const unavail = await createUnavailability(app, { user: newUser.id });

    const result = await app.graphql.query(
      graphql(
        `
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
        `,
        [fragments.user, fragments.unavailability],
      ),
      {
        id: newUser.id,
      },
    );
    const actual = result.user;
    expect(actual).toBeTruthy();
    expect(actual.unavailabilities.items[0]!.id).toBe(unavail.id);
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
      graphql(`
        mutation updateUser($input: UpdateUser!) {
          updateUser(input: $input) {
            user {
              email {
                value
              }
            }
          }
        }
      `),
      {
        input: {
          id: person.id,
          email: null,
        },
      },
    );
    expect(result.updateUser.user.email.value).toBeNull();
  });
});

async function assignOrganizationToUser(
  app: TestApp,
  input: VariablesOf<typeof AssignOrgToUserDoc>,
) {
  await app.graphql.mutate(AssignOrgToUserDoc, input);
}
const AssignOrgToUserDoc = graphql(`
  mutation assignOrganizationToUser($org: ID!, $user: ID!, $primary: Boolean) {
    assignOrganizationToUser(org: $org, user: $user, primary: $primary) {
      __typename
    }
  }
`);

async function removeOrganizationFromUser(
  app: TestApp,
  input: VariablesOf<typeof RemoveOrgFromUserDoc>,
) {
  await app.graphql.mutate(RemoveOrgFromUserDoc, input);
}
const RemoveOrgFromUserDoc = graphql(`
  mutation removeOrganizationFromUser($org: ID!, $user: ID!) {
    removeOrganizationFromUser(org: $org, user: $user) {
      __typename
    }
  }
`);
