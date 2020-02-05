import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Product } from '../src/components/product/product';
import { createTestApp, TestApp } from './utility';

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

describe.skip('Product e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
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
  it('update Product', async () => {
    const productId = await createProduct(app);
    const typenew = 'Songs';

    return await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateProduct (input: { product: {
            id: "${productId}",
            type: ${typenew},books:[Genesis],mediums:[Print],purposes:[ChurchLife],approach:Written,methodology:Paratext
          } }){
            product {
            id
            type
            }
          }
        }
          `,
      })
      .expect(({ body }) => {
        expect(body.data.updateProduct.product.id).toBe(productId);
        expect(body.data.updateProduct.product.type).toBe(typenew);
      })
      .expect(200);
  });
  it('delete product', async () => {
    const productId = await createProduct(app);
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteProduct (input: { product: { id: "${productId}" } }){
            product {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteProduct.product.id).toBe(productId);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
