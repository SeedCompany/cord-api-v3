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
        query product($id: ID!) {
          product(id: $id) {
            ...product
          }
        }
        ${fragments.product}
      `,
      {
        id: product?.id,
      }
    );
    const actual: Product | undefined = result.product;
    expect(actual?.id).toBe(product?.id);
    expect(actual?.type).toBe(product?.type);
    expect(actual?.books).toEqual(expect.arrayContaining(product?.books!));
    expect(actual?.mediums).toEqual(expect.arrayContaining(product?.mediums!));
    expect(actual?.purposes).toEqual(expect.arrayContaining(product?.purposes!));
    expect(actual?.approach).toBe(product?.approach);
    expect(actual?.methodology).toBe(product?.methodology);
  });

  it('update product', async () => {
    const product = await createProduct(app);
    const typenew = 'Songs';

    const result = await app.graphql.query(
      gql`
        mutation updateProduct($id: ID!, $type: ProductType!) {
          updateProduct(input: {
            product: {
              id: $id,
              type: $type
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
        id: product?.id,
        type: typenew,
      }
    );

    expect(result.updateProduct.product.id).toBe(product?.id);
    expect(result.updateProduct.product.type).toBe(typenew);
  });

  it('delete product', async () => {
    const product = await createProduct(app);
    expect(product?.id).toBeTruthy();
    const result = await app.graphql.mutate(
      gql`
        mutation deleteProduct($id: ID!) {
          deleteProduct(id: $id)
        }
      `,
      {
        id: product?.id,
      },
    );

    const actual: boolean | undefined = result.deleteProduct;
    expect(actual).toBeTruthy();
    try {
      await app.graphql.query(
        gql`
          query product($id: ID!) {
            product(id: $id) {
              ...product
            }
          }
          ${fragments.product}
        `,
        {
          id: product?.id,
        },
      );
    } catch (e) {
      expect(e.response.statusCode).toBe(404);
    }
  });

  afterAll(async () => {
    await app.close();
  });
});
