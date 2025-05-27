import { isValidId } from '~/common';
import { graphql } from '~/graphql';
import {
  type CreateDerivativeScriptureProduct,
  ProductMedium,
  ProductMethodology,
  ProductPurpose,
} from '../../src/components/product/dto';
import { type TestApp } from './create-app';
import { fragments, type RawProduct } from './fragments';

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
    graphql(
      `
        mutation createDerivativeScriptureProduct(
          $input: CreateDerivativeScriptureProduct!
        ) {
          createDerivativeScriptureProduct(input: $input) {
            product {
              ...product
            }
          }
        }
      `,
      [fragments.product],
    ),
    {
      input: product,
    },
  );

  const actual: RawProduct = result.createDerivativeScriptureProduct.product;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
