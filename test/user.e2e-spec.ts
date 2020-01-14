import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { isValid } from 'shortid';
import { CreateUserInput } from '../src/components/user/user.dto';

describe('User e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('create user', async () => {
    const email = 'newuser@test.com' + Date.now();
    const fn = 'George';
    const ln = 'Washington';

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createUser (input: { user: { email: "${email}", realFirstName: "${fn}", realLastName: "${ln}", displayFirstName: "${fn}", displayLastName: "${ln}"} }){
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
        const userId = body.data.createUser.user.id;
        expect(isValid(userId)).toBe(true);
        expect(body.data.createUser.user.email).toBe(email);
      })
      .expect(200);
  });

  it('read one user by id', async () => {
    const newUser = new CreateUserInput();
    newUser.email = 'newuser@test.com' + Date.now();
    const fn = 'George';
    const ln = 'Washington';


    // create user first
    let userId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createUser (input: { user: { email: "${newUser.email}", realFirstName: "${fn}", realLastName: "${ln}", displayFirstName: "${fn}", displayLastName: "${ln}"} }){
            user{
            id
            email,
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
        userId = body.data.createUser.user.id;
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readUser ( input: { user: { id: "${userId}" } }){
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
        expect(body.data.readUser.user.id).toBe(userId);
        expect(body.data.readUser.user.email).toBe(newUser.email);
      })
      .expect(200);
  });

  it('update user', async () => {
    const oldEmail = 'newUser@test.com' + Date.now();
    const email = 'updateuser@test.com' + Date.now();
    const fn = 'George';
    const ln = 'Washington';

    let userId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createUser (input: { user: { email: "${oldEmail}", realFirstName: "${fn}", realLastName: "${ln}", displayFirstName: "${fn}", displayLastName: "${ln}"} }){
            user{
            id
            email,
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
        userId = body.data.createUser.user.id;
      })
      .expect(200);

    return await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateUser (
            input: {
              user: {
                id: "${userId}"
                email: "${email}"
                realFirstName: "${fn}"
                realLastName: "${ln}"
                displayFirstName: "${fn}"
                displayLastName: "${ln}"
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
        expect(body.data.updateUser.user.id).toBe(userId);
        expect(body.data.updateUser.user.email).toBe(email);
      })
      .expect(200);
  });

  it('delete user', async () => {
    const email = 'deleteuser@test.com' + Date.now();
    const fn = 'George';
    const ln = 'Washington';

    let userId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createUser (input: { user: { email: "${email}", realFirstName: "${fn}", realLastName: "${ln}", displayFirstName: "${fn}", displayLastName: "${ln}"} }){
            user{
            id
            email,
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
        userId = body.data.createUser.user.id;
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteUser (input: { user: { id: "${userId}" } }){
            user {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteUser.user.id).toBe(userId);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
