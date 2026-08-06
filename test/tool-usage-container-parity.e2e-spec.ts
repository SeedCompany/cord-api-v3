import { beforeAll, describe, expect, it } from '@jest/globals';
import { type ID, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createLocation,
  createOrganization,
  createSession,
  createTestApp,
  createTool,
  registerUser,
  runAsAdmin,
  runInIsolatedSession,
  type TestApp,
} from './utility';

/**
 * `tools` is declared once on the `Resource` interface, and Nest copies an
 * interface field resolver onto every type that implements it — 40 concrete
 * types here. The field is not nullable, so a resolver that throws does not
 * produce a null `tools`: it nulls the whole parent object, and inside a list it
 * nulls the entire list.
 *
 * Neo4j answers an empty list for every one of those types, because its query
 * matched any `BaseNode`. Postgres has no single table holding every resource,
 * so its repository has to work out which table an id belongs to — and for a
 * type it cannot place, the id used to be dropped, which the DataLoader turned
 * into a thrown "could not find" error.
 *
 * These are the container types deliberately: Organization and Location are
 * ordinary resources with no reason to hold tool usages, and nothing about
 * either is special to the tools domain. That is the point — the field is on
 * every resource, so it has to answer for every resource.
 *
 * Runs on BOTH engines on purpose. These are parity tests, and they are only
 * meaningful if the Neo4j arm is asserted too.
 */
describe('Resource.tools answers for containers of any type', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [Role.Administrator, Role.FieldServices],
    });
  });

  it('returns an empty list for an Organization', async () => {
    const org = await createOrganization(app);

    const result = await app.graphql.query(
      graphql(`
        query orgTools($id: ID!) {
          organization(id: $id) {
            id
            tools {
              total
              canRead
              items {
                id
              }
            }
          }
        }
      `),
      { id: org.id },
    );

    expect(result.organization.id).toBe(org.id);
    expect(result.organization.tools.total).toBe(0);
    expect(result.organization.tools.items).toEqual([]);
  });

  it('returns an empty list for a Location', async () => {
    const location = await createLocation(app);

    const result = await app.graphql.query(
      graphql(`
        query locationTools($id: ID!) {
          location(id: $id) {
            id
            tools {
              total
              items {
                id
              }
            }
          }
        }
      `),
      { id: location.id },
    );

    expect(result.location.id).toBe(location.id);
    expect(result.location.tools.total).toBe(0);
  });

  /**
   * Two containers resolved in one operation, so they reach the repository as a
   * single DataLoader batch rather than one id at a time. That is the shape that
   * does the most damage with a non-null field: one container the repository
   * cannot place fails the batch, and every sibling in it goes down too.
   *
   * Deliberately two ids rather than the `organizations` list query. That list
   * also returns seeded organizations, at least one of which has a legacy
   * 24-character id and cannot be resolved on EITHER engine — a pre-existing
   * problem with that seed row, nothing to do with the container lookup. Asking
   * for known ids keeps this test measuring the batch and not the seed data.
   */
  it('answers for two containers resolved in the same batch', async () => {
    const first = await createOrganization(app);
    const second = await createOrganization(app);

    const result = await app.graphql.query(
      graphql(`
        query twoOrgTools($first: ID!, $second: ID!) {
          first: organization(id: $first) {
            id
            tools {
              total
            }
          }
          second: organization(id: $second) {
            id
            tools {
              total
            }
          }
        }
      `),
      { first: first.id, second: second.id },
    );

    expect(result.first.tools.total).toBe(0);
    expect(result.second.tools.total).toBe(0);
  });

  /**
   * Deleting a tool takes its usages with it.
   *
   * The two engines arrive there by different routes, which is exactly why this
   * asserts through the API instead of the database. Neo4j leaves the usage row
   * alone and its `hydrate()` drops it, because the required `node('tool','Tool')`
   * match fails once soft delete has relabelled the tool. Postgres soft-deletes
   * the usage rows outright (Rob's call 2026-08-05), so the reads exclude them by
   * their own `deleted_at`. Same answer, and the answer is what a client sees.
   *
   * Without this, a deleted tool kept being served on `Resource.tools` under
   * Postgres — and `tool` is a required field on the usage, so the stale row is
   * not a cosmetic leftover.
   */
  it('drops a usage when its tool is deleted, on either engine', async () => {
    const org = await createOrganization(app);
    const tool = await createTool(app);

    await app.graphql.mutate(
      graphql(`
        mutation createUsage($container: ID!, $tool: ID!) {
          createToolUsage(input: { container: $container, tool: $tool }) {
            toolUsage {
              id
            }
          }
        }
      `),
      { container: org.id, tool: tool.id },
    );

    const toolsOf = async (id: ID) => {
      const result = await app.graphql.query(
        graphql(`
          query orgToolsAfterDelete($id: ID!) {
            organization(id: $id) {
              tools {
                total
                items {
                  id
                }
              }
            }
          }
        `),
        { id },
      );
      return result.organization.tools;
    };

    // Assert the usage is actually there first, so the check after the delete
    // cannot pass by having never created anything.
    expect((await toolsOf(org.id)).total).toBe(1);

    await app.graphql.mutate(
      graphql(`
        mutation deleteTool($id: ID!) {
          deleteTool(id: $id) {
            __typename
          }
        }
      `),
      { id: tool.id },
    );

    const after = await toolsOf(org.id);
    expect(after.total).toBe(0);
    expect(after.items).toEqual([]);
  });

  it('refuses to record a usage against a deleted tool, on either engine', async () => {
    const org = await createOrganization(app);
    const tool = await createTool(app);

    await app.graphql.mutate(
      graphql(`
        mutation deleteToolFirst($id: ID!) {
          deleteTool(id: $id) {
            __typename
          }
        }
      `),
      { id: tool.id },
    );

    // Neo4j refuses because its create matches `:Tool` and deleting relabels the
    // node, so the pattern finds nothing. Postgres has only the foreign key,
    // which a soft-deleted row still satisfies — so it needs an explicit check to
    // answer the same way. Without one it stores a usage pointing at a tool that
    // no read can return.
    await expect(
      app.graphql.mutate(
        graphql(`
          mutation createUsageOnDeletedTool($container: ID!, $tool: ID!) {
            createToolUsage(input: { container: $container, tool: $tool }) {
              toolUsage {
                id
              }
            }
          }
        `),
        { container: org.id, tool: tool.id },
      ),
    ).rejects.toThrow();

    // And nothing was stored — a create that half-succeeded would leave the
    // usage visible even though the mutation reported failure.
    const result = await app.graphql.query(
      graphql(`
        query orgToolsAfterRefusedCreate($id: ID!) {
          organization(id: $id) {
            tools {
              total
            }
          }
        }
      `),
      { id: org.id },
    );
    expect(result.organization.tools.total).toBe(0);
  });

  /**
   * Deleting the person who recorded a usage must not take the page down with
   * them.
   *
   * `creator_id` is NOT NULL and keeps its value forever — soft delete leaves the
   * row alone — but the actor loader stops returning a removed user on purpose.
   * A naive port kept `creator` non-null and just loaded that id, so the load
   * raised "could not find", and a non-null field cannot report a failure in
   * place: GraphQL nulls the usage, then the list, then the object holding it.
   * `Resource.tools` lives on the `Resource` interface, so one departed staff
   * member broke pages across dozens of unrelated types.
   *
   * Both engines answer the same way (2026-08-07 — Postgres previously kept the
   * usage and blanked `creator` instead, which was a real improvement on Neo4j
   * but also a breaking GraphQL schema change; deferred post-migration so it can
   * be coordinated with API consumers on its own timeline rather than folded
   * into cutover parity):
   *
   * the usage disappears entirely, matching Neo4j's query requiring the creator
   * to match. The repository drops it before the `creator` field resolver ever
   * runs, so that field stays non-null.
   */
  it('survives the deletion of the user who recorded the usage', async () => {
    const org = await createOrganization(app);
    const tool = await createTool(app);

    // A second user records the usage, so the reader below is never the deleted
    // one — deleting your own account also ends your session, which would make
    // this measure the wrong thing.
    const creator = await runInIsolatedSession(app, async () => {
      const user = await registerUser(app, { roles: [Role.FieldServices] });
      await app.graphql.mutate(
        graphql(`
          mutation createUsageAsOther($container: ID!, $tool: ID!) {
            createToolUsage(input: { container: $container, tool: $tool }) {
              toolUsage {
                id
              }
            }
          }
        `),
        { container: org.id, tool: tool.id },
      );
      return user;
    });

    await runAsAdmin(app, async () => {
      await app.graphql.mutate(
        graphql(`
          mutation deleteCreator($id: ID!) {
            deleteUser(id: $id) {
              __typename
            }
          }
        `),
        { id: creator.id },
      );
    });

    // Selecting `creator` is the whole point — a thrown resolver would surface
    // here, and `items` would come back null rather than short.
    const result = await app.graphql.query(
      graphql(`
        query orgToolsAfterCreatorDeleted($id: ID!) {
          organization(id: $id) {
            id
            tools {
              total
              items {
                id
                creator {
                  id
                }
              }
            }
          }
        }
      `),
      { id: org.id },
    );

    // The object holding the list resolved at all — this is what used to break.
    expect(result.organization.id).toBe(org.id);
    expect(result.organization.tools.total).toBe(0);
    expect(result.organization.tools.items).toHaveLength(0);
  });
});
