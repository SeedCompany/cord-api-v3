import { INestApplication } from '@nestjs/common';
import { gql } from 'apollo-server-core';
import * as request from 'supertest';
import { Product } from '../src/components/product/product';
import { createTestApp, TestApp, fragments, createSession, createUser } from './utility';
import { createProduct } from './utility/create-product';

describe('Product e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('create & read product by id', async () => {
    const product = await createProduct(app);

    const result = await app.graphql.query(
      gql`
        query readProduct($id: ID!) {
          readProduct(input: {
            product: {
              id: $id
            }
          }) {
            product {
              ...product
            }
          }
        }
        ${fragments.product}
      `,
      {
        id: product.id,
      }
    );
    const actual: Product | undefined = result.readProduct.product;
    expect(actual.id).toBe(product.id);
    expect(actual.type).toBe(product.type);
    expect(actual.books).toEqual(expect.arrayContaining(product.books));
    expect(actual.mediums).toEqual(expect.arrayContaining(product.mediums));
    expect(actual.purposes).toEqual(expect.arrayContaining(product.purposes));
    expect(actual.approach).toBe(product.approach);
    expect(actual.methodology).toBe(product.methodology);
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
