import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { GraphQLModule } from '@nestjs/graphql';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('OrganizationController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('read one organization by id', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          read (id: "id"){
            id
            name
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.read.id).toBe('id');
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
