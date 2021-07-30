import { EmailService } from '@seedcompany/nestjs-email';
import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { isValidId } from '../src/common';
import { SecuredTimeZone } from '../src/components/timezone';
import { User } from '../src/components/user';
import {
  createSession,
  createTestApp,
  fragments,
  generateRegisterInput,
  login,
  logout,
  registerUser,
  TestApp,
} from './utility';
import { resetDatabase } from './utility/reset-database';

describe('Authentication e2e', () => {
  let app: TestApp;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    db = app.get(Connection);
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('Check Email Existence and Reset Password', async () => {
    const sendEmail = spyOn(app.get(EmailService), 'send');

    const fakeUser = await generateRegisterInput();
    const email = fakeUser.email;
    // create user first
    await registerUser(app, fakeUser);
    const checkRes = await app.graphql.mutate(
      gql`
        mutation forgotPassword($email: String!) {
          forgotPassword(email: $email)
        }
      `,
      {
        email: email,
      }
    );

    const tokenRes = await db
      .query()
      .matchNode('e', 'EmailToken', { value: email.toLowerCase() })
      .return<{ token: string }>('e.token as token')
      .first();

    const token = tokenRes ? tokenRes.token : '';
    const newPassword = faker.internet.password();
    const resetRes = await app.graphql.mutate(
      gql`
        mutation resetPassword($input: ResetPasswordInput!) {
          resetPassword(input: $input)
        }
      `,
      {
        input: {
          token: token,
          password: newPassword,
        },
      }
    );

    const { login: newLogin } = await login(app, {
      email: email,
      password: newPassword,
    });

    expect(checkRes.forgotPassword).toBe(true);
    expect(resetRes.resetPassword).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(newLogin.user.id).toBeDefined();
  });

  it('login user', async () => {
    const fakeUser = await generateRegisterInput();
    const user = await registerUser(app, fakeUser);
    await logout(app);

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

    return true;
  });

  it('should return true after password changed', async () => {
    const fakeUser = await generateRegisterInput();

    const user = await registerUser(app, fakeUser);

    const newPassword = faker.internet.password();
    const result = await app.graphql.mutate(
      gql`
        mutation changePassword($oldPassword: String!, $newPassword: String!) {
          changePassword(oldPassword: $oldPassword, newPassword: $newPassword)
        }
      `,
      {
        oldPassword: fakeUser.password,
        newPassword: newPassword,
      }
    );

    expect(result.changePassword).toBeTruthy();

    const updatedUser = await login(app, {
      email: fakeUser.email,
      password: newPassword,
    });
    expect(updatedUser.login.user.id).toBe(user.id);
  });
});
