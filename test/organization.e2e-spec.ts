import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { generate, isValid } from 'shortid';
import { CreateOrganizationInput } from '../src/components/organization/organization.dto';
import { Organization } from '../src/components/organization/organization';

async function createOrg(app: INestApplication, name: string): Promise<string> {
  let orgId;
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
          mutation {
            createOrganization (input: { organization: { name: "${name}" } }){
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
      expect(body.data.createOrganization.organization.name).toBe(name);
    })
    .expect(200);
  return orgId;
}

describe('Organization e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  // CREATE ORG
  it('create organization', () => {
    const orgName = 'orgName_' + generate();
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

  // READ ORG
  it('read one organization by id', async () => {
    const newOrg = new CreateOrganizationInput();
    newOrg.name = 'orgName_' + generate();
    const orgId = await createOrg(app, newOrg.name);

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

  // UPDATE ORG
  it('update organization', async () => {
    const newOrg = new CreateOrganizationInput();
    newOrg.name = 'orgName_' + generate();
    const orgId = await createOrg(app, newOrg.name);

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

  // DELETE ORG
  it('delete organization', async () => {
    const newOrg = new CreateOrganizationInput();
    newOrg.name = 'orgName_' + generate();
    const orgId = await createOrg(app, newOrg.name);

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

  // LIST ORGs
  it('list view of organizations', async () => {
    // create a bunch of orgs
    const totalOrgs = 10;
    const orgs: Organization[] = [];
    for (let i = 0; i < totalOrgs; i++) {
      const newOrg = new Organization();
      newOrg.name = 'orgName_' + generate();
      newOrg.id = await createOrg(app, newOrg.name);
      orgs.push(newOrg);
    }

    // test reading new org
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          organizations(
            input: {
              query: { filter: "", page: 0, count: ${totalOrgs}, sort: "name", order: "asc" }
            }
          ) {
            organizations {
              id
              name
            }
          }
        }
          `,
      })
      .expect(({ body }) => {
        console.log(body);
        expect(body.data.organizations.organizations.length).toBe(totalOrgs);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
