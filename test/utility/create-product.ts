import { gql } from 'graphql-tag';
import { isValidId } from '../../src/common';
import {
  CreateProduct,
  ProductMedium,
  ProductMethodology,
  ProductPurpose,
} from '../../src/components/product';
import { TestApp } from './create-app';
import { fragments, RawProduct } from './fragments';

export async function createProduct(app: TestApp, input: CreateProduct) {
  const product: CreateProduct = {
    mediums: [ProductMedium.Print],
    purposes: [ProductPurpose.ChurchLife],
    methodology: ProductMethodology.Paratext,
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

  const actual: RawProduct = result.createProduct.product;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
