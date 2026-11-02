import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createOtherProduct(
  app: TestApp,
  input: Omit<InputOf<typeof CreateOtherProductDoc>, 'title'> & {
    title?: string;
  },
) {
  const result = await app.graphql.mutate(CreateOtherProductDoc, {
    input: {
      mediums: ['Print'],
      purposes: ['ChurchLife'],
      methodology: 'Paratext',
      ...input,
      title: input.title ?? faker.hacker.noun() + faker.company.name(),
    },
  });

  const actual = result.createOtherProduct.product;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}

const CreateOtherProductDoc = graphql(
  `
    mutation createOtherProduct($input: CreateOtherProduct!) {
      createOtherProduct(input: $input) {
        product {
          ...product
          title {
            value
          }
        }
      }
    }
  `,
  [fragments.product],
);
