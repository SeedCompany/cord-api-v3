import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { GraphQLModule } from '@nestjs/graphql';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { isValid } from 'shortid';
import { DatabaseService } from '../src/core/database.service';
import { DatabaseUtility } from '../src/common/database-utility';
import { OrganizationService } from '../src/components/organization/organization.service';
import { CreateOrganizationInput } from '../src/components/organization/organization.dto';

describe('Organization e2e', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let dbUtility: DatabaseUtility;
  let orgService: OrganizationService;

  beforeAll(async () => {
    db = new DatabaseService();
    orgService = new OrganizationService(db);
    dbUtility = new DatabaseUtility(db, orgService);
    await dbUtility.resetDatabaseForTesting();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('create organization', () => {
    const orgName = 'bestOrgEver12345';
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
        const orgId = body.data.createOrganization.organization.id;
        expect(isValid(orgId)).toBe(true);
        expect(body.data.createOrganization.organization.name).toBe(orgName);
      })
      .expect(200);
  });

  it('read one organization by id', async () => {
    const newOrg = new CreateOrganizationInput();
    newOrg.name = 'orgNameForReadOrgTest1';
    const createdOrg = await orgService.create(newOrg);
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readOrganization ( input: { organization: { id: "${createdOrg.organization.id}" } }){
            organization{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readOrganization.organization.id).toBe(createdOrg.organization.id);
        expect(body.data.readOrganization.organization.name).toBe(createdOrg.organization.name);
      })
      .expect(200);
  });

  it('update organization', async () => {
    const newOrg = new CreateOrganizationInput();
    newOrg.name = 'orgNameForUpdateOrgTest1';
    const createdOrg = await orgService.create(newOrg);
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateOrganization (input: { organization: {id: "${createdOrg.organization.id}", name: "${createdOrg.organization.name}" } }){
            organization {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateOrganization.organization.id).toBe(createdOrg.organization.id);
        expect(body.data.updateOrganization.organization.name).toBe(createdOrg.organization.name);
      })
      .expect(200);
  });

  it('delete organization', async () => {
    const newOrg = new CreateOrganizationInput();
    newOrg.name = 'orgNameForDeleteOrgTest1';
    const createdOrg = await orgService.create(newOrg);
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteOrganization (input: { organization: { id: "${createdOrg.organization.id}" } }){
            organization {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteOrganization.organization.id).toBe(createdOrg.organization.id);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
