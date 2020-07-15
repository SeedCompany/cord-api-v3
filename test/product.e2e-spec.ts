import { gql } from 'apollo-server-core';
import { times } from 'lodash';
import {
  createLanguageEngagement,
  createSession,
  createTestApp,
  createUser,
  expectNotFound,
  fragments,
  TestApp,
} from './utility';
import { createProduct } from './utility/create-product';
import { RawLanguageEngagement, RawProduct } from './utility/fragments';

describe('Product e2e', () => {
  let app: TestApp;
  let engagement: RawLanguageEngagement;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
    engagement = await createLanguageEngagement(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('create & read product by id', async () => {
    const product = await createProduct(app, {
      engagementId: engagement.id,
    });

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
        id: product.id,
      }
    );
    const actual: RawProduct = result.product;
    expect(actual.id).toBe(product.id);
    expect(actual.mediums.value).toEqual(product.mediums.value);
    expect(actual.purposes.value).toEqual(product.purposes.value);
    expect(actual.approach).toBe(product.approach);
    expect(actual.methodology.value).toBe(product.methodology.value);
  });

  it('update product', async () => {
    const product = await createProduct(app, {
      engagementId: engagement.id,
    });

    const result = await app.graphql.query(
      gql`
        mutation updateProduct($id: ID!) {
          updateProduct(input: { product: { id: $id } }) {
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

    expect(result.updateProduct.product.id).toBe(product.id);
  });

  it('delete product', async () => {
    const product = await createProduct(app, {
      engagementId: engagement.id,
    });
    expect(product.id).toBeTruthy();
    const result = await app.graphql.mutate(
      gql`
        mutation deleteProduct($id: ID!) {
          deleteProduct(id: $id)
        }
      `,
      {
        id: product.id,
      }
    );

    const actual: boolean | undefined = result.deleteProduct;
    expect(actual).toBeTruthy();
    await expectNotFound(
      app.graphql.query(
        gql`
          query product($id: ID!) {
            product(id: $id) {
              ...product
            }
          }
          ${fragments.product}
        `,
        {
          id: product.id,
        }
      )
    );
  });

  it('List view of products', async () => {
    // create 2 products
    const numPartnerships = 2;
    await Promise.all(
      times(numPartnerships).map(() =>
        createProduct(app, {
          engagementId: engagement.id,
        })
      )
    );

    const { products } = await app.graphql.query(
      gql`
        query products {
          products {
            items {
              id
            }
            hasMore
            total
          }
        }
      `,
      {}
    );

    expect(products.items.length).toBeGreaterThanOrEqual(numPartnerships);
  });
});
