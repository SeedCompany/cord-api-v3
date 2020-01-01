import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { GraphQLModule } from '@nestjs/graphql';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { isValid } from 'shortid';
import { DatabaseService } from '../src/core/database.service';

describe('OrganizationController (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let orgId: string;
  const orgName = 'myOrg4';

  beforeAll(async () => {
    db = new DatabaseService();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('create organization', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createOrganization (name: "${orgName}"){
            id
            name
          }
        }
        `,
      })
      .expect(({ body }) => {
        orgId = body.data.createOrganization.id;
        expect(isValid(orgId)).toBe(true);
        expect(body.data.createOrganization.name).toBe(orgName);
      })
      .expect(200);
  });

  it('read one organization by id', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readOrganization (id: "${orgId}"){
            id
            name
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readOrganization.id).toBe(orgId);
        expect(body.data.readOrganization.name).toBe(orgName);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
