import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { EmailMessage } from '@seedcompany/nestjs-email';
import { type ComponentProps as PropsOf } from 'react';
import { type ID } from '~/common';
import { type ForgotPassword } from '~/core/authentication/emails/forgot-password.email';
import { MailerService } from '~/core/email';
import { graphql } from '~/graphql';
import { currentUser, login, logout, registerUser } from './operations/auth';
import { createApp, createTester, type TestApp, type Tester } from './setup';

type ForgotPasswordMsg = EmailMessage<PropsOf<typeof ForgotPassword>>;

describe('Authentication e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createApp();
  });

  it('Check Email Existence and Reset Password', async () => {
    const sendEmail = jest.spyOn(app.get(MailerService), 'send');
    const tester = createTester(app);

    // create user first
    const user = await tester.apply(registerUser());
    const email = user.email.value!;

    // request reset via forgot password
    await tester.apply(forgotPassword(email));

    // pull token from the email message
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const forgotPasswordMsg = sendEmail.mock.calls[0]![0]! as ForgotPasswordMsg;
    expect(forgotPasswordMsg).toBeInstanceOf(EmailMessage);
    const { token } = forgotPasswordMsg.body.props;
    expect(token).toEqual(expect.any(String));

    // reset password with token & new password
    const newPassword = faker.internet.password();
    await tester.apply(resetPassword(token, newPassword));

    // confirm the new password works to log in
    await tester.apply(
      login({
        email,
        password: newPassword,
      }),
    );
  });

  it('login user', async () => {
    const tester = createTester(app);
    const user = await tester.apply(registerUser());
    await tester.apply(logout());

    const res = await tester.apply(
      login({ email: user.email.value!, password: user.password }),
    );
    expect(res.user.id).toBe(user.id);
  });

  it('disabled users are logged out & cannot login', async () => {
    const tester = createTester(app);
    const user = await tester.apply(registerUser());

    // confirm they're logged in
    const before = await tester.apply(currentUser());
    expect(before?.id).toBe(user.id);

    await tester.apply(disableUser(user.id));

    // Confirm mutation logged them out
    const after = await tester.apply(currentUser());
    expect(after).toBeNull();

    // Confirm they can't log back in
    await expect(
      tester.apply(
        login({
          email: user.email.value!,
          password: user.password,
        }),
      ),
    ).rejects.toThrowGqlError({
      message: 'User is disabled',
      code: ['UserDisabled', 'Authentication', 'Client'],
    });
  });

  it('Password changed', async () => {
    const tester = createTester(app);

    // create user
    const user = await tester.apply(registerUser());

    // change password user
    const newPassword = faker.internet.password();
    await tester.apply(changePassword(user.password, newPassword));

    // Verify we can login with the new password
    await tester.apply(
      login({
        email: user.email.value!,
        password: newPassword,
      }),
    );
  });
});

const forgotPassword = (email: string) => async (tester: Tester) => {
  await tester.run(
    graphql(`
      mutation forgotPassword($email: String!) {
        forgotPassword(email: $email) {
          __typename
        }
      }
    `),
    { email },
  );
};

const resetPassword =
  (token: string, newPassword: string) => async (tester: Tester) => {
    await tester.run(
      graphql(`
        mutation resetPassword($token: String!, $newPassword: String!) {
          resetPassword(token: $token, password: $newPassword) {
            __typename
          }
        }
      `),
      { token, newPassword },
    );
  };

const changePassword =
  (oldPassword: string, newPassword: string) => async (tester: Tester) => {
    return await tester.run(
      graphql(`
        mutation changePassword($oldPassword: String!, $newPassword: String!) {
          changePassword(oldPassword: $oldPassword, newPassword: $newPassword) {
            __typename
          }
        }
      `),
      { oldPassword, newPassword },
    );
  };

const disableUser = (userId: ID) => async (tester: Tester) => {
  await tester.run(
    graphql(`
      mutation DisableUser($id: ID!) {
        updateUser(input: { id: $id, status: Disabled }) {
          __typename
        }
      }
    `),
    { id: userId },
  );
};
