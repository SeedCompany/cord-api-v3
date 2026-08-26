import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { times } from 'lodash';
import { isValidId, Role } from '~/common';
import { graphql } from '~/graphql';
import { ScriptureRange } from '../src/components/scripture/dto';
import {
  createSession,
  createStory,
  createTestApp,
  fragments,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';

describe('Story e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
  });

  it('Create Story', async () => {
    const name = faker.company.name();
    const scriptureReferences = ScriptureRange.randomList();
    const story = await createStory(app, { name, scriptureReferences });
    expect(story.scriptureReferences.value).toBeDefined();
    expect(story.scriptureReferences.value).toEqual(
      expect.arrayContaining(scriptureReferences),
    );
  });

  // READ STORY
  it('create & read story by id', async () => {
    const name = faker.company.name();
    const scriptureReferences = ScriptureRange.randomList();
    const story = await createStory(app, { name, scriptureReferences });

    const { story: actual } = await app.graphql.query(
      graphql(
        `
          query st($id: ID!) {
            story(id: $id) {
              ...story
            }
          }
        `,
        [fragments.story],
      ),
      {
        id: story.id,
      },
    );
    expect(actual.id).toBe(story.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name.value).toBe(story.name.value);
    expect(actual.scriptureReferences.value).toEqual(
      expect.arrayContaining(story.scriptureReferences.value),
    );
  });

  // UPDATE STORY
  it('update story', async () => {
    const st = await createStory(app);
    const newName = faker.company.name();
    const scriptureReferences = ScriptureRange.randomList();
    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateStory($input: UpdateStory!) {
            updateStory(input: $input) {
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
          id: st.id,
          name: newName,
          scriptureReferences,
        },
      },
    );
    const updated = result.updateStory.story;
    expect(updated).toBeTruthy();
    expect(updated.name.value).toBe(newName);
    expect(updated.scriptureReferences.value).toBeDefined();
    expect(updated.scriptureReferences.value).toEqual(
      expect.arrayContaining(scriptureReferences),
    );
  });

  // DELETE STORY
  //
  // Off since 2020, in a batch switched off with "tests were harmed. skipping
  // them to get this in. will make an unskip ticket" — and the ticket was never
  // made. It failed as written because this suite signs in as a
  // FieldOperationsDirector, whose grant is `r.Producible.edit.create`: read,
  // edit and create, never delete. No role-specific policy grants delete on a
  // producible.
  //
  // An Administrator can, though. `AdministratorPolicy` is
  // `allowAll('read', 'edit', 'create', 'delete')`, which covers producibles
  // along with everything else, so the mutation is reachable — just not by a
  // project-level role. Hence the delete runs in an admin session here while
  // the rest of the suite stays as it was.
  //
  // Whether a project role SHOULD be able to delete one is a product question,
  // not a migration question: it reads the same on Neo4j and Postgres, since
  // the check is `privileges.verifyCan` in the service layer, above the point
  // where the two databases diverge.
  it('delete story', async () => {
    const st = await createStory(app);
    const result = await runAsAdmin(
      app,
      async () =>
        await app.graphql.mutate(
          graphql(`
            mutation deleteStory($id: ID!) {
              deleteStory(id: $id) {
                __typename
              }
            }
          `),
          {
            id: st.id,
          },
        ),
    );
    const actual = result.deleteStory;
    expect(actual).toBeTruthy();
  });

  it('list view of stories', async () => {
    const numStories = 2;
    await Promise.all(times(numStories).map(() => createStory(app)));

    const { stories } = await app.graphql.query(
      graphql(
        `
          query {
            stories(input: { count: 15 }) {
              items {
                ...story
              }
              hasMore
              total
            }
          }
        `,
        [fragments.story],
      ),
    );

    expect(stories.items.length).toBeGreaterThanOrEqual(numStories);
  });
});
