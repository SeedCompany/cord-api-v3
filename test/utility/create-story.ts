import { faker } from '@faker-js/faker';
import { graphql } from '~/graphql';
import { type CreateStory } from '../../src/components/story/dto';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createStory(
  app: TestApp,
  input: Partial<CreateStory> = {},
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();

  const result = await app.graphql.mutate(
    graphql(
      `
        mutation createStory($input: CreateStoryInput!) {
          createStory(input: $input) {
            story {
              ...story
            }
          }
        }
      `,
      [fragments.story],
    ),
    {
      input: {
        story: {
          ...input,
          name,
        },
      },
    },
  );
  const st = result.createStory.story;

  expect(st).toBeTruthy();

  return st;
}
