import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

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
