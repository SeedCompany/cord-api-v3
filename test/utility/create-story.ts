import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { CreateStory, Story } from '../../src/components/story';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createStory(
  app: TestApp,
  input: Partial<CreateStory> = {}
) {
  const name = input.name || faker.hacker.noun() + faker.company.companyName();

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
    }
  );
  const st: Story = result.createStory.story;

  expect(st).toBeTruthy();

  return st;
}
