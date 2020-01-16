import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { generate, isValid } from 'shortid';
import { CreateOrganizationInput } from '../src/components/organization/organization.dto';
import { Organization } from '../src/components/organization/organization';

describe('Product e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  // CREATE Product
  it('create product', () => {
    const product = 'product_' + generate();
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createProduct(
            input: {
              product: {
                type: BibleStories
                books: [ Genesis, Exodus, Leviticus]
                mediums: [Web, Print]
                purposes: [ChurchLife, SocialIssues]
                approach: Written
                methodology: Paratext
              }
            }
          ) {
            product {
              id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        const orgId = body.data.createProduct.product.id;
        expect(isValid(orgId)).toBe(true);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
