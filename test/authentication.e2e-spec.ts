import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { isValid } from 'shortid';
import { SecuredTimeZone } from '../src/components/timezone';
import { User } from '../src/components/user';
import { EmailService } from '../src/core/email';
import {
  createSession,
  createTestApp,
  createUser,
  fragments,
  generateRegisterInput,
  login,
  logout,
  TestApp,
} from './utility';

describe('Authentication e2e', () => {
  let app: TestApp;
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    db = app.get(Connection);
  });

  it('Check Email Existence and Reset Password', async () => {
    const sendEmail = spyOn(app.get(EmailService), 'send');

    const fakeUser = generateRegisterInput();
    const email = fakeUser.email;
    // create user first
    await createUser(app, fakeUser);
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
      .raw(
        `
        MATCH
        (e:EmailToken {
          value: $email
        })
        RETURN
        e.token as token
      `,
        {
          email: email,
        }
      )
      .first();

    const token = tokenRes ? tokenRes.token : '';
    const resetRes = await app.graphql.mutate(
      gql`
        mutation resetPassword($input: ResetPasswordInput!) {
          resetPassword(input: $input)
        }
      `,
      {
        input: {
          token: token,
          password: faker.internet.password(),
        },
      }
    );

    expect(checkRes.forgotPassword).toBe(true);
    expect(resetRes.resetPassword).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('login user', async () => {
    const fakeUser = generateRegisterInput();
    const user = await createUser(app, fakeUser);
    const _logout = await logout(app);

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

    return true;
  });

  it('should return true after password changed', async () => {
    const fakeUser = generateRegisterInput();

    const user = await createUser(app, fakeUser);
    await login(app, { email: fakeUser.email, password: fakeUser.password });

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

  afterAll(async () => {
    await app.close();
  });
});
