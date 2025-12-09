import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Connection } from 'cypher-query-builder';
import { isValidId } from '~/common';
import { MailerService } from '~/core/email';
import { graphql } from '~/graphql';
import {
  createSession,
  createTestApp,
  CurrentUserDoc,
  fragments,
  generateRegisterInput,
  login,
  LoginDoc,
  logout,
  registerUser,
  type TestApp,
} from './utility';

describe('Authentication e2e', () => {
  let app: TestApp;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    db = app.get(Connection);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Check Email Existence and Reset Password', async () => {
    const sendEmail = jest.spyOn(app.get(MailerService), 'send');

    const fakeUser = await generateRegisterInput();
    const email = fakeUser.email;
    // create user first
    await registerUser(app, fakeUser);
    await app.graphql.mutate(
      graphql(`
        mutation forgotPassword($email: String!) {
          forgotPassword(email: $email) {
            __typename
          }
        }
      `),
      {
        email: email,
      },
    );

    const tokenRes = await db
      .query()
      .matchNode('e', 'EmailToken', { value: email.toLowerCase() })
      .return<{ token: string }>('e.token as token')
      .first();

    const token = tokenRes ? tokenRes.token : '';
    const newPassword = faker.internet.password();
    await app.graphql.mutate(
      graphql(`
        mutation resetPassword($input: ResetPasswordInput!) {
          resetPassword(input: $input) {
            __typename
          }
        }
      `),
      {
        input: {
          token: token,
          password: newPassword,
        },
      },
    );

    const { login: newLogin } = await login(app, {
      email: email,
      password: newPassword,
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(newLogin.user.id).toBeDefined();
  });

  it('login user', async () => {
    const fakeUser = await generateRegisterInput();
    const user = await registerUser(app, fakeUser);
    await logout(app);

    await login(app, { email: fakeUser.email, password: fakeUser.password });
    const result = await app.graphql.query(
      graphql(
        `
          query user($id: ID!) {
            user(id: $id) {
              ...user
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
  });

  it('disabled users are logged out & cannot login', async () => {
    const input = await generateRegisterInput();
    const user = await registerUser(app, input);

    // confirm they're logged in
    const before = await app.graphql.query(CurrentUserDoc);
    expect(before.session.user).toBeTruthy();

    await app.graphql.query(
      graphql(
        `
          mutation DisableUser($id: ID!) {
            updateUser(input: { user: { id: $id, status: Disabled } }) {
              __typename
            }
          }
        `,
      ),
      {
        id: user.id,
      },
    );

    // Confirm mutation logged them out
    const after = await app.graphql.query(CurrentUserDoc);
    expect(after.session.user).toBeNull();

    // Confirm they can't log back in
    await app.graphql
      .query(LoginDoc, {
        input: {
          email: input.email,
          password: input.password,
        },
      })
      .expectError({
        message: 'User is disabled',
        code: ['UserDisabled', 'Authentication', 'Client'],
      });
  });

  it('Password changed', async () => {
    const fakeUser = await generateRegisterInput();

    const user = await registerUser(app, fakeUser);

    const newPassword = faker.internet.password();
    await app.graphql.mutate(
      graphql(`
        mutation changePassword($oldPassword: String!, $newPassword: String!) {
          changePassword(oldPassword: $oldPassword, newPassword: $newPassword) {
            __typename
          }
        }
      `),
      {
        oldPassword: fakeUser.password,
        newPassword: newPassword,
      },
    );

    const updatedUser = await login(app, {
      email: fakeUser.email,
      password: newPassword,
    });
    expect(updatedUser.login.user.id).toBe(user.id);
  });
});
