import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import {
  CreateProduct,
  Product,
  ProductApproach,
  ProductMedium,
  ProductMethodology,
  ProductPurpose,
  ProductType,
} from '../../src/components/product';
import { BibleBook } from '../../src/components/product/dto/bible-book';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createProduct(
  app: TestApp,
  input: Partial<CreateProduct> = {}
) {
  const product: CreateProduct = {
    type: ProductType.BibleStories,
    books: [BibleBook.Genesis],
    mediums: [ProductMedium.Print],
    purposes: [ProductPurpose.ChurchLife],
    approach: ProductApproach.Written,
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

  const actual: Product = result.createProduct.product;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.type).toBe(product.type);

  return actual;
}
