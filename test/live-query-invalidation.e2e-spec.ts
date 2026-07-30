import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Role } from '~/common';
import { LiveQueryStore } from '~/core/live-query';
import { graphql } from '~/graphql';
import {
  createOrganization,
  createSession,
  createTestApp,
  registerUser,
  type TestApp,
} from './utility';

// The Drizzle repository base is only in play under postgres; under the other
// engines their own bases already invalidate and are unchanged by this fix.
const isPostgres = process.env.DATABASE === 'postgres';

type Identifier = Parameters<LiveQueryStore['invalidate']>[0];

/**
 * Resolve an identifier to the key that actually reaches the store, the same way
 * `LiveQueryStore.invalidateAll` does — so assertions pin the emitted key rather
 * than merely "something fired".
 */
const keyOf = (identifier: Identifier): string => {
  if (typeof identifier === 'string') {
    return identifier;
  }
  const [res, id] = identifier;
  const name = typeof res === 'string' ? res : (res as { name: string }).name;
  return `${name}:${id}`;
};

/**
 * Regression guard for LQ-1: the Drizzle repository base did not invalidate the
 * live-query store on update/delete, while the Neo4j and Gel bases both do it
 * generically. The consequence was user-visible rather than theoretical — ~12
 * cord-field documents carry `@live` and they are the detail page of nearly
 * every domain, so after cutover editing any of them left an open page stale
 * until manual refresh.
 *
 * Organization is the worked example from the audit: its service has no manual
 * `liveQueryStore.invalidate` call anywhere, so anything observed here came from
 * the base and nowhere else.
 *
 * NOTE on the spy: restore in `afterEach`, NEVER in a `finally` ahead of the
 * assertions. `mockRestore()` is `mockReset()` + restore, so it clears
 * `mock.calls` — every assertion then reads an empty array, which fails the
 * positive cases and passes the negative one no matter what the code does.
 */
describe('Live-query invalidation (Drizzle base) e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.Administrator] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Spy on the exact store instance the DI container hands the repositories. */
  const watchInvalidations = () =>
    jest.spyOn(app.get(LiveQueryStore), 'invalidate');

  it('invalidates the mutated resource on update', async () => {
    if (!isPostgres) return;
    const org = await createOrganization(app);
    const spy = watchInvalidations();

    const newName = `${org.name.value ?? 'Org'} (renamed)`;
    const updated = await app.graphql.mutate(UpdateOrgDoc, {
      input: { id: org.id, name: newName },
    });

    // Control: proves the mutation actually ran and changed the row, so a zero
    // invalidation count can only mean the invalidation itself is missing.
    expect(updated.updateOrganization.organization.name.value).toBe(newName);

    expect(spy.mock.calls.map(([arg]) => keyOf(arg))).toContain(
      `Organization:${org.id}`,
    );
  });

  it('invalidates the mutated resource on soft delete', async () => {
    if (!isPostgres) return;
    const org = await createOrganization(app);
    const spy = watchInvalidations();

    await app.graphql.mutate(DeleteOrgDoc, { id: org.id });

    expect(spy.mock.calls.map(([arg]) => keyOf(arg))).toContain(
      `Organization:${org.id}`,
    );
  });

  // The no-op guard in updateColumns() returns before touching the DB; it must
  // return before invalidating too, or every empty update wakes every live query
  // watching that resource for no reason.
  it('does not invalidate when an update changes nothing', async () => {
    if (!isPostgres) return;
    const org = await createOrganization(app);
    const spy = watchInvalidations();

    // Same name it already has -> getActualChanges yields an empty change set.
    await app.graphql.mutate(UpdateOrgDoc, {
      input: { id: org.id, name: org.name.value ?? 'Org' },
    });

    expect(spy.mock.calls.map(([arg]) => keyOf(arg))).not.toContain(
      `Organization:${org.id}`,
    );
  });
});

const UpdateOrgDoc = graphql(`
  mutation UpdateOrgForLiveQuery($input: UpdateOrganization!) {
    updateOrganization(input: $input) {
      organization {
        id
        name {
          value
        }
      }
    }
  }
`);

const DeleteOrgDoc = graphql(`
  mutation DeleteOrgForLiveQuery($id: ID!) {
    deleteOrganization(id: $id) {
      __typename
    }
  }
`);
