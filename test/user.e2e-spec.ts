import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { isValid } from 'shortid';
import { CreateUserInput } from '../src/components/user/user.dto';
import { generate } from 'shortid';
import { User } from 'src/components/user/user';
import { serialize } from 'v8';

async function createToken(app: INestApplication): Promise<string> {
  let token;
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
      mutation{
        createToken{
          token
        }
      }
    `,
    })
    .expect(({ body }) => {
      token = body.data.createToken.token;
    })
    .expect(200);

  return token;
}

async function createUser(app: INestApplication): Promise<User> {
  const user = new User();
  user.token = await createToken(app);
  user.email = 'email_' + generate(); // needs to be unique in db, other props don't
  user.realFirstName = 'realFirstName';
  user.realLastName = 'realLastName';
  user.displayFirstName = 'displayFirstName';
  user.displayLastName = 'displayLastName';
  user.password = 'password';

  await request(app.getHttpServer())
    .post('/graphql')
    .set('token', user.token)
    .send({
      operationName: null,
      query: `
    mutation {
      createUser (input: { user: { email: "${user.email}", realFirstName: "${user.realFirstName}", realLastName: "${user.realLastName}", displayFirstName: "${user.displayFirstName}", displayLastName: "${user.displayLastName}", password: "${user.password}" } }){
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
      user.id = body.data.createUser.user.id;
      expect(isValid(user.id)).toBe(true);
      expect(body.data.createUser.user.email).toBe(user.email);
    })
    .expect(200);
  return user;
}

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
