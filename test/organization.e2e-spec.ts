import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { GraphQLModule } from '@nestjs/graphql';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { isValid } from 'shortid';
import { DatabaseService } from '../src/core/database.service';
import { DatabaseUtility } from '../src/common/database-utility';

describe('Organization e2e', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let dbUtility: DatabaseUtility;

  let orgId: string;
  const orgName = 'myOrg4';
  const newOrgName = 'newMyOrg4';

  beforeAll(async () => {
    db = new DatabaseService();
    dbUtility = new DatabaseUtility(db);
    await dbUtility.deleteAllData();
    await dbUtility.deleteAllConstraintsAndIndexes();
    await dbUtility.prepareDatabase();
    await dbUtility.loadTestData();
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
          createOrganization (input: { organization: { name: "${orgName}" } }){
            organization{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        orgId = body.data.createOrganization.organization.id;
        expect(isValid(orgId)).toBe(true);
        expect(body.data.createOrganization.organization.name).toBe(orgName);
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
          readOrganization ( input: { organization: { id: "${orgId}" } }){
            organization{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readOrganization.organization.id).toBe(orgId);
        expect(body.data.readOrganization.organization.name).toBe(orgName);
      })
      .expect(200);
  });

  it('update organization', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateOrganization (input: { organization: {id: "${orgId}", name: "${newOrgName}" } }){
            organization {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateOrganization.organization.id).toBe(orgId);
        expect(body.data.updateOrganization.organization.name).toBe(newOrgName);
      })
      .expect(200);
  });

  it('delete organization', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteOrganization (input: { organization: { id: "${orgId}" } }){
            organization {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteOrganization.organization.id).toBe(orgId);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
