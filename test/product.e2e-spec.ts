import * as request from 'supertest';

import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { INestApplication } from '@nestjs/common';
import { Product } from 'src/components/product/product';

async function createProduct(app: INestApplication): Promise<Product> {
  let productId;
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
    mutation {
        createProduct (input: { product: { type: BibleStories,books:[Genesis],mediums:[Print],purposes:[ChurchLife],approach:Written,methodology:Paratext }}){
        product {
        id
        type
        }
      }
    }
    `,
    })
    .then(({ body }) => {
      productId = body.data.createProduct.product.id;
    });
  return productId;
}

describe('Product e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('read one product by id', async () => {
    const productId = await createProduct(app);
    const type = 'BibleStories';
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readProduct ( input: { product: { id: "${productId}" } }){
            product{
              id
              type,
              books,
              mediums,
              purposes,
              approach,
              methodology
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readProduct.product.id).toBe(productId);
        expect(body.data.readProduct.product.type).toBe(type);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
