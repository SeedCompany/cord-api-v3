import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import { Story } from '../src/components/product/story/dto';
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

  // Create STORY
  it('Create Story', async () => {
    const name = faker.company.companyName();
    await createStory(app, { name });
  });

  // READ STORY
  it('create & read story by id', async () => {
    const st = await createStory(app);

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
        id: st.id,
      }
    );
    expect(actual.id).toBe(st.id);
    expect(isValid(actual.id)).toBe(true);
    expect(actual.name.value).toBe(st.name.value);
  });

  // UPDATE STORY
  it('update story', async () => {
    const st = await createStory(app);
    const newName = faker.company.companyName();
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
            ranges: [
              {
                id: st.ranges.value[0].id,
                start: faker.random.number(),
                end: faker.random.number(),
              },
            ],
          },
        },
      }
    );
    const updated = result.updateStory.story;
    expect(updated).toBeTruthy();
    expect(updated.ranges.value[0].id).toBe(st.ranges.value[0].id);
    expect(updated.name.value).toBe(newName);
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
        createStory(app, { name: generate() + ' Inc' })
      )
    );

    const { storys } = await app.graphql.query(gql`
      query {
        storys(input: { count: 15, filter: { name: "Inc" } }) {
          items {
            ...story
          }
          hasMore
          total
        }
      }
      ${fragments.story}
    `);
    expect(storys.items.length).toBeGreaterThanOrEqual(numStorys);
  });

  it('List view filters on name', async () => {
    const name = faker.lorem.word();
    await createStory(app, { name });

    const { storys } = await app.graphql.query(
      gql`
        query storys($name: String!) {
          storys(input: { filter: { name: $name } }) {
            items {
              ...story
            }
            hasMore
            total
          }
        }
        ${fragments.story}
      `,
      { name }
    );
    expect(storys.total).toEqual(1);
    expect(storys.items[0].name.value).toBe(name);
  });
});
