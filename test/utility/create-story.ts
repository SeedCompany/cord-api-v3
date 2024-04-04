import { faker } from '@faker-js/faker';
import { CreateStory, Story } from '../../src/components/story/dto';
import { TestApp } from './create-app';
import { fragments } from './fragments';
import { gql } from './gql-tag';

export async function createStory(
  app: TestApp,
  input: Partial<CreateStory> = {},
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();

  const result = await app.graphql.mutate(
    gql`
      mutation createStory($input: CreateStoryInput!) {
        createStory(input: $input) {
          story {
            ...story
          }
        }
      }
      ${fragments.story}
    `,
    {
      input: {
        story: {
          ...input,
          name,
        },
      },
    },
  );
  const st: Story = result.createStory.story;

  expect(st).toBeTruthy();

  return st;
}
