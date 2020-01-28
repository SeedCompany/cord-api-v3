import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { generate, isValid } from 'shortid';
import { Organization } from 'src/components/organization';
import { OrganizationTest, UserTest } from 'test/dto';
import { createUser } from './create-user';

export async function createOrganization(
  app: INestApplication,
  user?: UserTest,
): Promise<OrganizationTest> {
  // create token, then user, then org

  const org: OrganizationTest = {
    organization: {
      name: {
        value: 'orgName_' + generate(),
        canEdit: true,
        canRead: true,
      },
      createdAt: null,
      id: generate(),
    },
    user: user === undefined ? await createUser(app) : user,
  };

  const gql = await request(app.getHttpServer())
    .post('/graphql')
    .set('token', org.user.token)
    .send({
      operationName: null,
      query: `
      mutation {
        createOrganization(input: {
            organization: {
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
      expect(isValid(body.data.createOrganization.organization.id)).toBe(true);
      expect(body.data.createOrganization.organization.name.value).toBe(
        org.organization.name.value,
      );
    })
    .expect(200);
  return {
    organization: gql.body.data.createOrganization.organization,
    user: org.user,
  };
}
