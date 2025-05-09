import { isValidId } from '~/common';
import {
  type CreateDirectScriptureProduct,
  ProductMedium,
  ProductMethodology,
  ProductPurpose,
} from '../../src/components/product/dto';
import { type TestApp } from './create-app';
import { fragments, type RawProduct } from './fragments';
import { gql } from './gql-tag';

export async function createDirectProduct(
  app: TestApp,
  input: CreateDirectScriptureProduct,
) {
  const product: CreateDirectScriptureProduct = {
    mediums: [ProductMedium.Print],
    purposes: [ProductPurpose.ChurchLife],
    methodology: ProductMethodology.Paratext,
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createDirectScriptureProduct(
        $input: CreateDirectScriptureProduct!
      ) {
        createDirectScriptureProduct(input: $input) {
          product {
            ...product
          }
        }
      }
      ${fragments.product}
    `,
    {
      input: product,
    },
  );

  const actual: RawProduct = result.createDirectScriptureProduct.product;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
