import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import { createRandomScriptureReferences } from '../src/components/scripture/reference';
import { Story } from '../src/components/story/dto';
import {
  createSession,
  createStory,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';

describe('Story e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Create Story', async () => {
    const name = faker.company.companyName();
    const scriptureReferences = createRandomScriptureReferences();
    const story = await createStory(app, { name, scriptureReferences });
    expect(story.scriptureReferences.value).toBeDefined();
    expect(story.scriptureReferences.value).toEqual(scriptureReferences);
  });

  // READ STORY
  it('create & read story by id', async () => {
    const name = faker.company.companyName();
    const scriptureReferences = createRandomScriptureReferences();
    const story = await createStory(app, { name, scriptureReferences });

    const { story: actual } = await app.graphql.query(
      gql`
        query st($id: ID!) {
          story(id: $id) {
            ...story
          }
        }
        ${fragments.story}
      `,
      {
        id: story.id,
      }
    );
    expect(actual.id).toBe(story.id);
    expect(isValid(actual.id)).toBe(true);
    expect(actual.name.value).toBe(story.name.value);
    expect(actual.scriptureReferences.value).toEqual(
      story.scriptureReferences.value
    );
  });

  // UPDATE STORY
  it('update story', async () => {
    const st = await createStory(app);
    const newName = faker.company.companyName();
    const scriptureReferences = createRandomScriptureReferences();
    const result = await app.graphql.mutate(
      gql`
        mutation updateStory($input: UpdateStoryInput!) {
          updateStory(input: $input) {
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
            id: st.id,
            name: newName,
            scriptureReferences,
          },
        },
      }
    );
    const updated = result.updateStory.story;
    expect(updated).toBeTruthy();
    expect(updated.name.value).toBe(newName);
    expect(updated.scriptureReferences.value).toBeDefined();
    expect(updated.scriptureReferences.value).toEqual(scriptureReferences);
  });

  // DELETE STORY
  it('delete story', async () => {
    const st = await createStory(app);
    const result = await app.graphql.mutate(
      gql`
        mutation deleteStory($id: ID!) {
          deleteStory(id: $id)
        }
      `,
      {
        id: st.id,
      }
    );
    const actual: Story | undefined = result.deleteStory;
    expect(actual).toBeTruthy();
  });

  // LIST STORYs
  it('list view of storys', async () => {
    // create a bunch of storys
    const numStorys = 2;
    await Promise.all(
      times(numStorys).map(() =>
        createStory(app, { name: generate() + ' Story' })
      )
    );

    const { stories } = await app.graphql.query(gql`
      query {
        stories(input: { count: 15, filter: { name: "Story" } }) {
          items {
            ...story
          }
          hasMore
          total
        }
      }
      ${fragments.story}
    `);

    expect(stories.items.length).toBeGreaterThanOrEqual(numStorys);
  });
});
