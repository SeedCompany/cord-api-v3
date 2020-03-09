import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import { CreateProductRaw, Product } from '../../src/components/product';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createProduct(
  app: TestApp,
  input: Partial<CreateProductRaw> = {}
) {
  const product: CreateProductRaw = {
    type: 'BibleStories',
    books: ['Genesis'],
    mediums: ['Print'],
    purposes: ['ChurchLife'],
    approach: 'Written',
    methodology: 'Paratext',
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createProduct($input: CreateProductInput!) {
        createProduct(input: $input) {
          product {
            ...product
          }
        }
      }
      ${fragments.product}
    `,
    {
      input: {
        product,
      },
    }
  );

  const actual: Product = result.createProduct.product;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.type).toBe(product.type);

  return actual;
}
