import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { Organization } from '../src/components/organization/organization';
import { createOrg } from './test-utility';

describe('Organization e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  // READ ORG
  it('read one organization by id', async () => {
    const org = await createOrg(app);

    // test reading new org
    return request(app.getHttpServer())
      .post('/graphql')
      .set('token', org.createdBy.token)
      .send({
        operationName: null,
        query: `
        query {
          readOrganization ( input: { organization: { id: "${org.id}" } }){
            organization{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readOrganization.organization.id).toBe(org.id);
        expect(body.data.readOrganization.organization.name).toBe(org.name);
      })
      .expect(200);
  });

  // UPDATE ORG
  it('update organization', async () => {
    const org = await createOrg(app);

    return request(app.getHttpServer())
      .post('/graphql')
      .set('token', org.createdBy.token)
      .send({
        operationName: null,
        query: `
        mutation {
          updateOrganization (input: { organization: {id: "${org.id}", name: "${org.name}" } }){
            organization {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateOrganization.organization.id).toBe(org.id);
        expect(body.data.updateOrganization.organization.name).toBe(
          org.name,
        );
      })
      .expect(200);
  });

  // DELETE ORG
  it('delete organization', async () => {
    const org = await createOrg(app);

    return request(app.getHttpServer())
      .post('/graphql')
      .set('token', org.createdBy.token)
      .send({
        operationName: null,
        query: `
        mutation {
          deleteOrganization (input: { organization: { id: "${org.id}" } }){
            organization {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteOrganization.organization.id).toBe(org.id);
      })
      .expect(200);
  });

  // LIST ORGs
  it('list view of organizations', async () => {
    // create a bunch of orgs
    const totalOrgs = 10;
    const orgs: Organization[] = [];
    for (let i = 0; i < totalOrgs; i++) {
      const org = await createOrg(app);
      orgs.push(org);
    }

    // test reading new org
    return request(app.getHttpServer())
      .post('/graphql')
      .set('token', orgs[0].createdBy.token)
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
        expect(body.data.organizations.organizations.length).toBe(totalOrgs);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
