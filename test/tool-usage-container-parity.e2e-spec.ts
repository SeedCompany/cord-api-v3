import { beforeAll, describe, expect, it } from '@jest/globals';
import { Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createLocation,
  createOrganization,
  createSession,
  createTestApp,
  registerUser,
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
 * Runs on BOTH engines on purpose. It is a parity test, and it is only
 * meaningful if the Neo4j arm is also asserted to return the same thing.
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
});
