import { gql } from 'apollo-server-core';
import { SES } from 'aws-sdk';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { CreateUser } from '../src/components/user';
import { createSession, createTestApp, createUser, TestApp } from './utility';
import { MockedSES } from './utility/aws';

describe('Authentication e2e', () => {
  let app: TestApp;
  let db: Connection;
  let ses: MockedSES;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    db = app.get(Connection);
    ses = app.get(SES);
  });

  beforeEach(() => {
    ses.sendEmail.mockClear();
  });

  it('Check Email Existance and Reset Passsword', async () => {
    const email = faker.internet.email();
    const fakeUser: CreateUser = {
      email: email,
      realFirstName: faker.name.firstName(),
      realLastName: faker.name.lastName(),
      displayFirstName: faker.name.firstName(),
      displayLastName: faker.name.lastName(),
      password: faker.internet.password(),
      phone: faker.phone.phoneNumber(),
      timezone: 'timezone detail',
      bio: 'bio detail',
    };
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
    expect(ses.sendEmail).toHaveBeenCalledTimes(1);
  });

  afterAll(async () => {
    await app.close();
  });
});
