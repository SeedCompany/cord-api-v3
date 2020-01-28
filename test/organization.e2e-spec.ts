import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { Organization } from '../src/components/organization';
import { createOrganization } from './utility/create-organization';
import { OrganizationTest } from './dto';

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
    const org = await createOrganization(app);

    // test reading new org
    return request(app.getHttpServer())
      .post('/graphql')
      .set('token', org.user.token)
      .send({
        operationName: null,
        query: `
        query {
          organization( id: "${org.organization.id}"  ) {
              id
              name {
                  value
                  canRead
                  canEdit
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.organization.id).toBe(org.organization.id);
        expect(body.data.organization.name.value).toBe(
          org.organization.name.value,
        );
      })
      .expect(200);
  });

  // UPDATE ORG
  it('update organization', async () => {
    const org = await createOrganization(app);

    return request(app.getHttpServer())
      .post('/graphql')
      .set('token', org.user.token)
      .send({
        operationName: null,
        query: `
        mutation {
          updateOrganization(input: {
            organization: { id: "${org.organization.id}"
            name: "${org.organization.name.value}"
          }
        }) {
            organization {
              id
              name {
                  value
                  canRead
                  canEdit
              }
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateOrganization.organization.id).toBe(
          org.organization.id,
        );
        expect(body.data.updateOrganization.organization.name.value).toBe(
          org.organization.name.value,
        );
      })
      .expect(200);
  });

  // DELETE ORG
  it('delete organization', async () => {
    const org = await createOrganization(app);

    return request(app.getHttpServer())
      .post('/graphql')
      .set('token', org.user.token)
      .send({
        operationName: null,
        query: `
        mutation {
          deleteOrganization (id: "${org.organization.id}")
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteOrganization).toBe(true);
      })
      .expect(200);
  });

  // LIST ORGs
  it('list view of organizations', async () => {
    // create a bunch of orgs
    const totalOrgs = 10;
    const orgs: OrganizationTest[] = [];
    for (let i = 0; i < totalOrgs; i++) {
      const org = await createOrganization(app);
      orgs.push(org);
    }

    // test reading new org
    return request(app.getHttpServer())
      .post('/graphql')
      .set('token', orgs[0].user.token)
      .send({
        operationName: null,
        query: `
        query {
          organizations(input: {
            name: "",
            count: ${totalOrgs},
            sort: "name",
          }) {
              hasMore
              total
              items{
                  id
                  name {
                      value
                      canRead
                      canEdit
                  }
              }
          }
        }
          `,
      })
      .expect(({ body }) => {
        expect(body.data.organizations.items.length).toBe(totalOrgs);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
