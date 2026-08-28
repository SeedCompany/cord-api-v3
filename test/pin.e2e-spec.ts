import { beforeAll, describe, expect, it } from '@jest/globals';
import { Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createPerson,
  createPin,
  createProject,
  createSession,
  createTestApp,
  fragments,
  registerUser,
  type TestApp,
} from './utility';

describe('Pin e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
  });

  it('should pin project', async () => {
    const project = await createProject(app);
    expect(project.pinned).toBe(false);

    await createPin(app, project.id, true);
    const result = await app.graphql.query(
      graphql(
        `
          query project($id: ID!) {
            project(id: $id) {
              ...project
            }
          }
        `,
        [fragments.project],
      ),
      {
        id: project.id,
      },
    );

    const actual = result.project;
    expect(actual.id).toBe(project.id);
    expect(actual.pinned).toBe(true);
  });

  it('filters the users list to those pinned by the requester', async () => {
    const pinnedPerson = await createPerson(app);
    const unpinnedPerson = await createPerson(app);
    await createPin(app, pinnedPerson.id, true);

    // Newest first so the people created above land on page 1 even against a
    // loaded production-scale database — with the default sort, 2,300+
    // migrated users push a just-created person off the first page and the
    // pinned:false assertion below fails on data volume, not behavior.
    const UsersByPinnedDoc = graphql(`
      query usersByPinned($pinned: Boolean!) {
        users(
          input: {
            count: 25
            page: 1
            sort: "createdAt"
            order: DESC
            filter: { pinned: $pinned }
          }
        ) {
          items {
            id
            pinned
          }
          total
        }
      }
    `);

    const pinnedOnly = await app.graphql.query(UsersByPinnedDoc, {
      pinned: true,
    });
    // Only the person this requester pinned — the project pinned in the test
    // above must not leak in, and nobody else is pinned.
    expect(pinnedOnly.users.items.map((item) => item.id)).toEqual([
      pinnedPerson.id,
    ]);
    expect(pinnedOnly.users.items[0]!.pinned).toBe(true);

    const unpinned = await app.graphql.query(UsersByPinnedDoc, {
      pinned: false,
    });
    const unpinnedIds = unpinned.users.items.map((item) => item.id);
    expect(unpinnedIds).not.toContain(pinnedPerson.id);
    expect(unpinnedIds).toContain(unpinnedPerson.id);
  });
});
