import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createTool(
  app: TestApp,
  input: Partial<InputOf<typeof CreateToolDoc>> = {},
) {
  const name = input.name || faker.hacker.noun() + ' ' + faker.company.name();

  const result = await app.graphql.mutate(CreateToolDoc, {
    input: {
      aiBased: false,
      ...input,
      name,
    },
  });
  const tool = result.createTool.tool;

  expect(tool).toBeTruthy();

  return tool;
}

const CreateToolDoc = graphql(
  `
    mutation createTool($input: CreateTool!) {
      createTool(input: $input) {
        tool {
          ...tool
        }
      }
    }
  `,
  [fragments.tool],
);
