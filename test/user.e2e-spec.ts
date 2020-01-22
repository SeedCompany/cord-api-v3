import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { createUser } from './test-utility';

describe('User e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('read one user by id', async () => {
    // create user first
    const user = await createUser(app);

    return request(app.getHttpServer())
      .post('/graphql')
      .set('token', user.token)
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
        expect(body.data.readUser.user.email).toBe(user.email);
      })
      .expect(200);
  });

  it('update user', async () => {
    const newEmail = 'newUser@test.com' + Date.now();

    const user = await createUser(app);

    return await request(app.getHttpServer())
      .post('/graphql')
      .set('token', user.token)
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
        expect(body.data.updateUser.user.email).toBe(newEmail);
      })
      .expect(200);
  });

  it('delete user', async () => {
    const user = await createUser(app);

    return request(app.getHttpServer())
      .post('/graphql')
      .set('token', user.token)
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
