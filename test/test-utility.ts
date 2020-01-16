import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { generate, isValid } from 'shortid';
import { Organization } from 'src/components/organization/organization';

// CREATE ORG
export async function createOrg(
  app: INestApplication,
): Promise<Organization> {
  const org = new Organization();
  org.name = 'orgName_' + generate();
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
          mutation {
            createOrganization (input: { organization: { name: "${org.name}" } }){
              organization{
              id
              name
              }
            }
          }
          `,
    })
    .expect(({ body }) => {
      org.id = body.data.createOrganization.organization.id;
      expect(isValid(org.id)).toBe(true);
      expect(body.data.createOrganization.organization.name).toBe(org.name);
    })
    .expect(200);
  return org;
}
