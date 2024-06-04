import { isValidId } from '~/common';
import {
  CreateDerivativeScriptureProduct,
  ProductMedium,
  ProductMethodology,
  ProductPurpose,
} from '../../src/components/product/dto';
import { TestApp } from './create-app';
import { fragments, RawProduct } from './fragments';
import { gql } from './gql-tag';

export async function createDerivativeProduct(
  app: TestApp,
  input: CreateDerivativeScriptureProduct,
) {
  const product: CreateDerivativeScriptureProduct = {
    mediums: [ProductMedium.Print],
    purposes: [ProductPurpose.ChurchLife],
    methodology: ProductMethodology.Paratext,
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createDerivativeScriptureProduct(
        $input: CreateDerivativeScriptureProduct!
      ) {
        createDerivativeScriptureProduct(input: $input) {
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

  const actual: RawProduct = result.createDerivativeScriptureProduct.product;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
