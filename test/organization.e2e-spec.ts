import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { isValid } from 'shortid';
import { CreateOrganizationInput } from '../src/components/organization/organization.dto';

describe('Organization e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('create organization', () => {
    const orgName = 'bestOrgEver12345' + Date.now();
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
    newOrg.name = 'orgNameForReadOrgTest1' + Date.now();

    // create org first
    let orgId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createOrganization (input: { organization: { name: "${newOrg.name}" } }){
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
      })
      .expect(200);

    // test reading new org
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
        expect(body.data.readOrganization.organization.name).toBe(newOrg.name);
      })
      .expect(200);
  });

  it('update organization', async () => {
    const newOrg = new CreateOrganizationInput();
    newOrg.name = 'orgNameForUpdateOrgTest1' + Date.now();

    // create org first
    let orgId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
          mutation {
            createOrganization (input: { organization: { name: "${newOrg.name}" } }){
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
      })
      .expect(200);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateOrganization (input: { organization: {id: "${orgId}", name: "${newOrg.name}" } }){
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
        expect(body.data.updateOrganization.organization.name).toBe(
          newOrg.name,
        );
      })
      .expect(200);
  });

  it('delete organization', async () => {
    const newOrg = new CreateOrganizationInput();
    newOrg.name = 'orgNameForDeleteOrgTest1' + Date.now();
    

    // create org first
    let orgId;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
              mutation {
                createOrganization (input: { organization: { name: "${newOrg.name}" } }){
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
      })
      .expect(200);

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
