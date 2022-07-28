import { isValidId } from '../../src/common';
import {
  CreateDerivativeScriptureProductInput,
  ProductMedium,
  ProductMethodology,
  ProductPurpose,
} from '../../src/components/product';
import { TestApp } from './create-app';
import { fragments, RawProduct } from './fragments';
import { gql } from './gql-tag';

export async function createDerivativeProduct(
  app: TestApp,
  { product: input }: CreateDerivativeScriptureProductInput
) {
  const product: CreateDerivativeScriptureProductInput = {
    product: {
      mediums: [ProductMedium.Print],
      purposes: [ProductPurpose.ChurchLife],
      methodology: ProductMethodology.Paratext,
      ...input,
    },
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createDerivativeScriptureProduct(
        $input: CreateDerivativeScriptureProductInput!
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
    }
  );

  const actual: RawProduct = result.createDerivativeScriptureProduct.product;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
