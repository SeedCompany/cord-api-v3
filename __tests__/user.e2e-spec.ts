import * as request from 'supertest';
import { createTestApp, createToken, createUser, TestApp } from './utility';

describe('User e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it('read one user by id', async () => {
    // create user first
    const token = await createToken(app);
    const user = await createUser(app);

    return request(app.getHttpServer())
      .post('/graphql')
      .set('token', token)
      .send({
        operationName: null,
        query: `
        query {
          readUser ( input: { user: { id: "${user.id}" } }){
            user{
            id
            email
            realFirstName
            realLastName
            displayFirstName
            displayLastName
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readUser.user.id).toBe(user.id);
        expect(body.data.readUser.user.email.value).toBe(user.email);
      })
      .expect(200);
  });

  it('update user', async () => {
    const newEmail = 'newUser@test.com' + Date.now();
    const token = await createToken(app);
    const user = await createUser(app);

    await request(app.getHttpServer())
      .post('/graphql')
      .set('token', token)
      .send({
        operationName: null,
        query: `
        mutation {
          updateUser (
            input: {
              user: {
                id: "${user.id}"
                email: "${newEmail}"
                realFirstName: "${user.realFirstName}"
                realLastName: "${user.realLastName}"
                displayFirstName: "${user.displayFirstName}"
                displayLastName: "${user.displayLastName}"
              }
            }
            ) {
            user {
              id
              email
              realFirstName
              realLastName
              displayFirstName
              displayLastName
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateUser.user.id).toBe(user.id);
        expect(body.data.updateUser.user.email.value).toBe(newEmail);
      })
      .expect(200);
  });

  it('delete user', async () => {
    const token = await createToken(app);
    const user = await createUser(app);

    return request(app.getHttpServer())
      .post('/graphql')
      .set('token', token)
      .send({
        operationName: null,
        query: `
        mutation {
          deleteUser (input: { user: { id: "${user.id}" } }){
            user {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteUser.user.id).toBe(user.id);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
