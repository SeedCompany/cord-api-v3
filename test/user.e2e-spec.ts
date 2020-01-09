import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { isValid } from 'shortid';
import { DatabaseService } from '../src/core/database.service';
import { DatabaseUtility } from '../src/common/database-utility';
import { UserService } from '../src/components/user/user.service';
import { CreateUserInput } from '../src/components/user/user.dto';
import { OrganizationService } from '../src/components/organization/organization.service';

describe('User e2e', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let dbUtility: DatabaseUtility;
  let orgService: OrganizationService;
  let userService: UserService;

  beforeAll(async () => {
    db = new DatabaseService();
    userService = new UserService(db);
    orgService = new OrganizationService(db);
    dbUtility = new DatabaseUtility(db, orgService, userService);
    //await dbUtility.resetDatabaseForTesting();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('create user', () => {
    const UserEmail = 'bestUserEver12345@test.com';
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createUser (input: { user: { email: "${UserEmail}" } }){
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
        expect(body.data.createUser.user.email).toBe(UserEmail);
      })
      .expect(200);
  });

  it('read one user by id', async () => {
    const newUser = new CreateUserInput();
    newUser.email = 'UserEmailForReadUserTest1@test.com';
    const createdUser = await userService.create(newUser);
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readUser ( input: { user: { id: "${createdUser.user.id}" } }){
            user{
            id
            email
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readUser.user.id).toBe(createdUser.user.id);
        expect(body.data.readUser.user.email).toBe(createdUser.user.email);
      })
      .expect(200);
  });

  it('update user', async () => {
    const newUser = new CreateUserInput();
    newUser.email = 'UserEmailForUpdateUserTest1@test.com';
    const createdUser = await userService.create(newUser);
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateUser (input: { user: {id: "${createdUser.user.id}", email: "${createdUser.user.email}" } }){
            user {
            id
            email
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateUser.user.id).toBe(createdUser.user.id);
        expect(body.data.updateUser.user.email).toBe(createdUser.user.email);
      })
      .expect(200);
  });

  it('delete user', async () => {
    const newUser = new CreateUserInput();
    newUser.email = 'UserEmailForDeleteUserTest1@test.com';
    const createdUser = await userService.create(newUser);
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteUser (input: { user: { id: "${createdUser.user.id}" } }){
            user {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteUser.user.id).toBe(createdUser.user.id);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
