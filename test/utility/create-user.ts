import { INestApplication } from '@nestjs/common';
import { User } from 'src/components/user/user';
import * as request from 'supertest';
import { generate, isValid } from 'shortid';
import { createToken } from './create-token';
import { UserTest } from 'test/dto';

export async function createUser(
  app: INestApplication,
  token?: string,
): Promise<UserTest> {
  const user: User = {
    id: generate(),
    token: token === undefined ? await createToken(app) : token,
    email: 'email_' + generate(), // needs to be unique in db, other props don't
    realFirstName: 'realFirstName',
    realLastName: 'realLastName',
    displayFirstName: 'displayFirstName',
    displayLastName: 'displayLastName',
    password: 'password',
  };

  const gql = await request(app.getHttpServer())
    .post('/graphql')
    .set('token', user.token)
    .send({
      operationName: null,
      query: `
    mutation {
      createUser (input: {
        user: {
          email: "${user.email}",
          realFirstName: "${user.realFirstName}",
          realLastName: "${user.realLastName}",
          displayFirstName: "${user.displayFirstName}",
          displayLastName: "${user.displayLastName}",
          password: "${user.password}"
        }
      }){
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
      expect(isValid(body.data.createUser.user.id)).toBe(true);
      expect(body.data.createUser.user.email).toBe(user.email);
    })
    .expect(200);

  return {
    user: gql.body.data.createUser.user,
    token: user.token,
  };
}
