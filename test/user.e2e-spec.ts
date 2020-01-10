import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { isValid } from 'shortid';
//import { DatabaseService } from '../src/core/database.service';
import { DatabaseUtility } from '../src/common/database-utility';
//import { UserService } from '../src/components/user/user.service';
import { CreateUserInput } from '../src/components/user/user.dto';
import { async } from 'rxjs/internal/scheduler/async';
//import { LanguageService } from '../src/components/language/language.service';

describe('User e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // db = new DatabaseService();
    // userService = new UserService(db);
    // dbUtility = new DatabaseUtility(db, userService);
    // await dbUtility.resetDatabaseForTesting();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    const db: DatabaseUtility = app.get(DatabaseUtility);
    await db.resetDatabaseForTesting();
  });

  it('create user', async() => {
    const userEmail = 'bestUserlEver12345@test.com';
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createUser (input: { user: { email: "${userEmail}" } }){
            user{
            id
            email
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        const userId = body.data.createUser.user.id;
        expect(isValid(userId)).toBe(true);
        expect(body.data.createUser.user.email).toBe(userEmail);
      })
      .expect(200);
  });

  it('read one user by id', async () => {
    const newUser = new CreateUserInput();
    newUser.email = 'userEmailForReadUserlTest1@test.com';

    // create user first
    let userId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createUser (input: { user: { email: "${newUser.email}" } }){
            user{
            id
            email
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        userId = body.data.createUser.user.id;
      })
      .expect(200);

    // test reading new user
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
    const newUser = new CreateUserInput();
    newUser.email = 'userEmailForUpdateUserlTest1@test.com';
    // const createdUserl = await userService.create(newUser);

    // create user first
    let userId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
          mutation {
            createUser (input: { user: { email: "${newUser.email}" } }){
              user{
              id
              email
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
          updateUser (input: { user: {id: "${userId}", email: "${newUser.email}" } }){
            user {
            id
            email
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateUser.user.id).toBe(userId);
        expect(body.data.updateUser.user.email).toBe(
          newUser.email,
        );
      })
      .expect(200);
  });

  it('delete user', async () => {
    const newUser = new CreateUserInput();
    newUser.email = 'userEmailForDeleteUserlTest1@test.com';
    // const createdUserl = await userService.create(newUser);

    // create user first
    let userId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
              mutation {
                createUser (input: { user: { email: "${newUser.email}" } }){
                  user{
                  id
                  email
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
        expect(body.data.deleteUser.user.id).toBe(
          userId,
        );
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
