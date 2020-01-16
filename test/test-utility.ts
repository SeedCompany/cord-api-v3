import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { generate, isValid } from 'shortid';
import { Organization } from 'src/components/organization/organization';
import { User } from 'src/components/user/user';

// CREATE TOKEN
export async function createToken(app: INestApplication): Promise<string> {
  let token;
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
      mutation{
        createToken{
          token
        }
      }
    `,
    })
    .expect(({ body }) => {
      token = body.data.createToken.token;
    })
    .expect(200);

  return token;
}

// CREATE USER
export async function createUser(app: INestApplication): Promise<User> {
  const user = new User();
  user.token = await createToken(app);
  user.email = 'email_' + generate(); // needs to be unique in db, other props don't
  user.realFirstName = 'realFirstName';
  user.realLastName = 'realLastName';
  user.displayFirstName = 'displayFirstName';
  user.displayLastName = 'displayLastName';
  user.password = 'password';

  await request(app.getHttpServer())
    .post('/graphql')
    .set('token', user.token)
    .send({
      operationName: null,
      query: `
    mutation {
      createUser (input: { user: { email: "${user.email}", realFirstName: "${user.realFirstName}", realLastName: "${user.realLastName}", displayFirstName: "${user.displayFirstName}", displayLastName: "${user.displayLastName}", password: "${user.password}" } }){
        user{
        id
        email
        realFirstName
        realLastName
        displayFirstName
        displayLastName
        }
      }
    }
    `,
    })
    .expect(({ body }) => {
      user.id = body.data.createUser.user.id;
      expect(isValid(user.id)).toBe(true);
      expect(body.data.createUser.user.email).toBe(user.email);
    })
    .expect(200);
  return user;
}

// CREATE ORG
export async function createOrg(app: INestApplication): Promise<Organization> {
  const user = await createUser(app);
  const org = new Organization();
  org.name = 'orgName_' + generate();
  await request(app.getHttpServer())
    .post('/graphql')
    .set('token', user.token)
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
