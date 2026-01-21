import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createStory(
  app: TestApp,
  input: Partial<InputOf<typeof CreateStoryDoc>> = {},
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();

  const result = await app.graphql.mutate(CreateStoryDoc, {
    input: {
      ...input,
      name,
    },
  });
  const st = result.createStory.story;

  expect(st).toBeTruthy();

  return st;
}

const CreateStoryDoc = graphql(
  `
    mutation createStory($input: CreateStory!) {
      createStory(input: $input) {
        story {
          ...story
        }
      }
    }
  `,
  [fragments.story],
);
