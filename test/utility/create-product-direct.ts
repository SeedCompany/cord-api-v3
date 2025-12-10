import { expect } from '@jest/globals';
import { isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createDirectProduct(
  app: TestApp,
  input: InputOf<typeof CreateDirectScriptureProductDoc>,
) {
  const result = await app.graphql.mutate(CreateDirectScriptureProductDoc, {
    input: {
      mediums: ['Print'],
      purposes: ['ChurchLife'],
      methodology: 'Paratext',
      ...input,
    },
  });

  const actual = result.createDirectScriptureProduct.product;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}

const CreateDirectScriptureProductDoc = graphql(
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
);
