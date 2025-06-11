import { isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createDerivativeProduct(
  app: TestApp,
  input: InputOf<typeof CreateDerivativeScriptureProductDoc>,
) {
  const result = await app.graphql.mutate(CreateDerivativeScriptureProductDoc, {
    input: {
      mediums: ['Print'],
      purposes: ['ChurchLife'],
      methodology: 'Paratext',
      ...input,
    },
  });

  const actual = result.createDerivativeScriptureProduct.product;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}

const CreateDerivativeScriptureProductDoc = graphql(
  `
    mutation createDerivativeScriptureProduct($input: CreateDerivativeScriptureProduct!) {
      createDerivativeScriptureProduct(input: $input) {
        product {
          ...product
        }
      }
    }
  `,
  [fragments.product],
);
