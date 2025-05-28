import { isValidId } from '~/common';
import { graphql } from '~/graphql';
import {
  type CreateDirectScriptureProduct,
  ProductMedium,
  ProductMethodology,
  ProductPurpose,
} from '../../src/components/product/dto';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

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
    graphql(
      `
        mutation createDirectScriptureProduct(
          $input: CreateDirectScriptureProduct!
        ) {
          createDirectScriptureProduct(input: $input) {
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

  const actual = result.createDirectScriptureProduct.product;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
