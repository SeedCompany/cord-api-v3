import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { EmailService } from '@seedcompany/nestjs-email';
import { Connection } from 'cypher-query-builder';
import { isValidId } from '~/common';
import {
  createSession,
  createTestApp,
  fragments,
  generateRegisterInput,
  gql,
  login,
  logout,
  registerUser,
  TestApp,
} from './utility';
import { RawUser } from './utility/fragments';

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
    const sendEmail = jest.spyOn(app.get(EmailService), 'send');

    const fakeUser = await generateRegisterInput();
    const email = fakeUser.email;
    // create user first
    await registerUser(app, fakeUser);
    await app.graphql.mutate(
      gql`
        mutation forgotPassword($email: String!) {
          forgotPassword(email: $email) {
            __typename
          }
        }
      `,
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
      gql`
        mutation resetPassword($input: ResetPasswordInput!) {
          resetPassword(input: $input) {
            __typename
          }
        }
      `,
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
      },
    );

    const actual: RawUser = result.user;
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

    return true;
  });

  it('should return true after password changed', async () => {
    const fakeUser = await generateRegisterInput();

    const user = await registerUser(app, fakeUser);

    const newPassword = faker.internet.password();
    await app.graphql.mutate(
      gql`
        mutation changePassword($oldPassword: String!, $newPassword: String!) {
          changePassword(oldPassword: $oldPassword, newPassword: $newPassword) {
            __typename
          }
        }
      `,
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
