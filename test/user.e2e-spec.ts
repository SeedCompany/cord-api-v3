import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { times } from 'lodash';
import { firstValueFrom, timeout } from 'rxjs';
import { firstLettersOfWords, generateId, type ID, isValidId } from '~/common';
import { Broadcaster } from '~/core/broadcast';
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
  requestFileUpload,
  runInIsolatedSession,
  type TestApp,
  uploadFileContents,
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

  // The mutations return the very same `UserCreated`/`UserUpdated`/`UserDeleted`
  // types that the `userCreated`/`userUpdated`/`userDeleted` subscriptions
  // resolve to — one set of types serves both, so a mutation's response is the
  // event payload. Asserting on the response therefore pins the contract that
  // webhook subscribers depend on, with no graphql-ws client needed.
  //
  // What that leaves untested is *delivery*: that an event reaches the right
  // channel (`user:{action}` for everyone, `user:{id}:{action}` for a watcher
  // filtering on one user), and that the read-permission gate omits events for
  // users the watcher cannot see. Ceremony and Language have the same gap.
  describe('user mutation events', () => {
    it('createPerson identifies the new user and the acting actor', async () => {
      const { password: _, ...input } = await generateRegisterInput();

      const { createPerson: event } = await app.graphql.mutate(
        CreatePersonReturningDoc,
        { input },
      );

      expect(isValidId(event.userId)).toBe(true);
      expect(event.at).toBeDefined();
      expect(event.by.canRead).toBe(true);
      expect(event.by.value?.id).toBeDefined();
      // The `user` field is what keeps pre-existing consumers working.
      expect(event.user.id).toBe(event.userId);
    });

    it('reports the changed input fields in updatedKeys', async () => {
      const person = await createPerson(app);

      const { updatedKeys } = await updateUserReturning(app, {
        id: person.id,
        title: 'Regional Director',
        status: UserStatus.Disabled,
      });

      expect(updatedKeys).toContain('title');
      expect(updatedKeys).toContain('status');
      // Untouched fields are not reported.
      expect(updatedKeys).not.toContain('timezone');
      // `photo` is assembled separately from the other changes, so it is the
      // one key at risk of being reported unconditionally.
      expect(updatedKeys).not.toContain('photo');
    });

    it('carries new values in `updated` and prior values in `previous`', async () => {
      const person = await createPerson(app, { title: 'Before' });

      const { updated, previous, user } = await updateUserReturning(app, {
        id: person.id,
        title: 'After',
      });

      expect(updated.title).toBe('After');
      expect(previous.title).toBe('Before');
      expect(user.title.value).toBe('After');
      // `previous` carries only the keys that changed.
      expect(previous.status).toBeNull();
    });

    // Identifying/contact fields are deliberately absent from the `UserUpdate`
    // type — they would bypass field-level privileges, since the subscription
    // only checks that the watcher can read the user at all. They are still
    // reported in `updatedKeys` so a subscriber knows to re-read the user.
    it('reports omitted sensitive fields in updatedKeys without exposing values', async () => {
      const person = await createPerson(app);

      const { updatedKeys } = await updateUserReturning(app, {
        id: person.id,
        email: faker.internet.email(),
        realFirstName: faker.person.firstName(),
      });

      expect(updatedKeys).toContain('email');
      expect(updatedKeys).toContain('realFirstName');
    });

    it('reports no changes when nothing actually changes', async () => {
      const person = await createPerson(app, { title: 'Same' });

      const { updatedKeys, previous, updated } = await updateUserReturning(
        app,
        {
          id: person.id,
          title: 'Same',
        },
      );

      expect(updatedKeys).toHaveLength(0);
      expect(previous.title).toBeNull();
      expect(updated.title).toBeNull();
    });

    // `photo` is resolved by reading the file after the write, not from the
    // input's `upload` id, so this one path covers both upload mechanisms —
    // a direct `file` upload has no id in the input to read.
    it('reports a photo change with the new file version', async () => {
      const person = await createPerson(app);
      const upload = await requestFileUpload(app);
      const file = await uploadFileContents(app, upload.url);

      const { updatedKeys, updated } = await app.graphql
        .mutate(UpdateUserPhotoReturningDoc, {
          input: {
            id: person.id,
            // `name` is required whenever `upload` is used rather than `file`.
            photo: { upload: upload.id, name: file.name },
          },
        })
        .then((r) => r.updateUser);

      expect(updatedKeys).toContain('photo');
      expect(updated.photo?.canRead).toBe(true);
      expect(updated.photo?.value?.id).toBe(upload.id);
    });

    it('deleteUser identifies the deleted user', async () => {
      const person = await createPerson(app);

      const { deleteUser: event } = await app.graphql.mutate(
        graphql(`
          mutation deleteUserReturning($id: ID!) {
            deleteUser(id: $id) {
              __typename
              userId
              at
            }
          }
        `),
        { id: person.id },
      );

      expect(event.__typename).toBe('UserDeleted');
      expect(event.userId).toBe(person.id);
    });

    it('addLocationToUser reports the added location', async () => {
      const person = await createPerson(app);
      const location = await createLocation(app);

      const event = await addLocationReturning(app, {
        user: person.id,
        location: location.id,
      });

      expect(event.userId).toBe(person.id);
      expect(event.updatedKeys).toContain('locations');
      expect(event.updated.locations?.items.map((l) => l.id)).toEqual([
        location.id,
      ]);
    });

    it('removeLocationFromUser reports the removed location', async () => {
      const person = await createPerson(app);
      const location = await createLocation(app);
      await addLocationReturning(app, {
        user: person.id,
        location: location.id,
      });

      const event = await removeLocationReturning(app, {
        user: person.id,
        location: location.id,
      });

      expect(event.updatedKeys).toContain('locations');
      expect(event.updated.locations?.items.map((l) => l.id)).toEqual([
        location.id,
      ]);
    });

    // The link already being in the requested state is not a change, so no
    // event is published and the response carries empty diffs.
    it('re-adding an existing location reports no change', async () => {
      const person = await createPerson(app);
      const location = await createLocation(app);
      const args = { user: person.id, location: location.id };

      await addLocationReturning(app, args);
      const second = await addLocationReturning(app, args);

      expect(second.updatedKeys).toHaveLength(0);
      expect(second.updated.locations).toBeNull();
    });

    // Organization assignment publishes nothing yet — neither repository
    // implementation reports whether anything changed.
    it('organization mutations return the event shape with empty diffs', async () => {
      const person = await createPerson(app);

      const { assignOrganizationToUser: event } = await app.graphql.mutate(
        graphql(`
          mutation assignOrgReturning($org: ID!, $user: ID!) {
            assignOrganizationToUser(org: $org, user: $user) {
              userId
              updatedKeys
              by {
                canRead
              }
            }
          }
        `),
        { org: org.id, user: person.id },
      );

      expect(event.userId).toBe(person.id);
      expect(event.updatedKeys).toHaveLength(0);
      expect(event.by.canRead).toBe(true);
    });
  });

  // The tests above read a mutation's *response*, which is `publishToAll`'s
  // return value — so they pass even if nothing reaches a channel. These watch
  // the channels themselves, because `UserChannels.forAction` assembles names by
  // string concatenation and a wrong name would route events nowhere silently.
  describe('userUpdated channel delivery', () => {
    it('reaches the domain-wide channel', async () => {
      const person = await createPerson(app);
      const broadcaster = app.get(Broadcaster);

      const received = firstValueFrom(
        broadcaster
          .channel<{ user: ID }>('user:updated')
          .observe()
          .pipe(timeout(10_000)),
      );

      await updateUserReturning(app, { id: person.id, title: 'Channel' });

      expect((await received).user).toBe(person.id);
    });

    it('reaches the per-user channel, which is what an id filter subscribes to', async () => {
      const person = await createPerson(app);
      const broadcaster = app.get(Broadcaster);

      const received = firstValueFrom(
        broadcaster
          .channel<{ user: ID }>(`user:${person.id}:updated`)
          .observe()
          .pipe(timeout(10_000)),
      );

      await updateUserReturning(app, { id: person.id, title: 'PerUser' });

      expect((await received).user).toBe(person.id);
    });

    it('does not put one user’s change on another user’s channel', async () => {
      const [subject, other] = await Promise.all([
        createPerson(app),
        createPerson(app),
      ]);
      const broadcaster = app.get(Broadcaster);

      const otherSaw: Array<{ user: ID }> = [];
      const sub = broadcaster
        .channel<{ user: ID }>(`user:${other.id}:updated`)
        .observe()
        .subscribe((e) => otherSaw.push(e));

      // Await the subject's own channel so we know the publish has happened
      // before asserting on the other channel's silence.
      const subjectReceived = firstValueFrom(
        broadcaster
          .channel<{ user: ID }>(`user:${subject.id}:updated`)
          .observe()
          .pipe(timeout(10_000)),
      );
      await updateUserReturning(app, { id: subject.id, title: 'Isolated' });
      await subjectReceived;

      sub.unsubscribe();
      expect(otherSaw).toHaveLength(0);
    });
  });
});

async function updateUserReturning(
  app: TestApp,
  input: InputOf<typeof UpdateUserReturningDoc>,
) {
  const result = await app.graphql.mutate(UpdateUserReturningDoc, { input });
  return result.updateUser;
}
const UpdateUserReturningDoc = graphql(`
  mutation updateUserReturning($input: UpdateUser!) {
    updateUser(input: $input) {
      updatedKeys
      updated {
        title
        status
        timezone
      }
      previous {
        title
        status
        timezone
      }
      user {
        id
        title {
          value
        }
      }
      by {
        canRead
        value {
          id
        }
      }
    }
  }
`);

async function addLocationReturning(
  app: TestApp,
  vars: VariablesOf<typeof AddLocationReturningDoc>,
) {
  const result = await app.graphql.mutate(AddLocationReturningDoc, vars);
  return result.addLocationToUser;
}
const AddLocationReturningDoc = graphql(`
  mutation addLocationToUserReturning($user: ID!, $location: ID!) {
    addLocationToUser(user: $user, location: $location) {
      userId
      updatedKeys
      updated {
        locations(mutation: Added) {
          canRead
          items {
            id
          }
        }
      }
    }
  }
`);
async function removeLocationReturning(
  app: TestApp,
  vars: VariablesOf<typeof RemoveLocationReturningDoc>,
) {
  const result = await app.graphql.mutate(RemoveLocationReturningDoc, vars);
  return result.removeLocationFromUser;
}
const RemoveLocationReturningDoc = graphql(`
  mutation removeLocationFromUserReturning($user: ID!, $location: ID!) {
    removeLocationFromUser(user: $user, location: $location) {
      userId
      updatedKeys
      updated {
        locations(mutation: Removed) {
          canRead
          items {
            id
          }
        }
      }
    }
  }
`);

const UpdateUserPhotoReturningDoc = graphql(`
  mutation updateUserPhotoReturning($input: UpdateUser!) {
    updateUser(input: $input) {
      updatedKeys
      updated {
        photo {
          canRead
          value {
            id
          }
        }
      }
    }
  }
`);

const CreatePersonReturningDoc = graphql(`
  mutation createPersonReturning($input: CreatePerson!) {
    createPerson(input: $input) {
      __typename
      userId
      at
      user {
        id
      }
      by {
        canRead
        value {
          id
        }
      }
    }
  }
`);

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
