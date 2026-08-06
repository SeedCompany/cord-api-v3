import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { type ID, Role } from '~/common';
import { LiveQueryStore } from '~/core/live-query';
import { graphql } from '~/graphql';
import {
  createDirectProduct,
  createLanguageEngagement,
  createOrganization,
  createSession,
  createTestApp,
  registerUser,
  type TestApp,
} from './utility';

// The Drizzle repository base is only in play under postgres; under the other
// engines their own bases already invalidate and are unchanged by this fix.
const isPostgres = process.env.DATABASE === 'postgres';
// Neo4j and Gel invalidate generically from their own bases (see the docblock
// below), so these cases don't apply there. `it.skip` reports that honestly;
// an early `return` inside the body would report the same run as PASSED.
const itPostgresOnly = isPostgres ? it : it.skip;

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
  let engagement: { id: ID };

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [Role.Administrator, Role.ProjectManager],
    });
    if (isPostgres) {
      engagement = await createLanguageEngagement(app);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Spy on the exact store instance the DI container hands the repositories. */
  const watchInvalidations = () =>
    jest.spyOn(app.get(LiveQueryStore), 'invalidate');

  itPostgresOnly('invalidates the mutated resource on update', async () => {
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

  itPostgresOnly(
    'invalidates the mutated resource on soft delete',
    async () => {
      const org = await createOrganization(app);
      const spy = watchInvalidations();

      await app.graphql.mutate(DeleteOrgDoc, { id: org.id });

      expect(spy.mock.calls.map(([arg]) => keyOf(arg))).toContain(
        `Organization:${org.id}`,
      );
    },
  );

  // The no-op guard in updateColumns() returns before touching the DB; it must
  // return before invalidating too, or every empty update wakes every live query
  // watching that resource for no reason.
  itPostgresOnly(
    'does not invalidate when an update changes nothing',
    async () => {
      const org = await createOrganization(app);
      const spy = watchInvalidations();

      // Same name it already has -> getActualChanges yields an empty change set.
      await app.graphql.mutate(UpdateOrgDoc, {
        input: { id: org.id, name: org.name.value ?? 'Org' },
      });

      expect(spy.mock.calls.map(([arg]) => keyOf(arg))).not.toContain(
        `Organization:${org.id}`,
      );
    },
  );

  // Product hand-rolls its own writes, so it invalidates itself rather than
  // inheriting from the base. The interesting part is the KEY: the store keys on
  // `${resource.name}:${id}`, and the Neo4j arm passes the CONCRETE subtype
  // (DirectScriptureProduct, not Product). A generic `Product:` key would emit
  // something nothing subscribes to — an invalidation that exists and does
  // nothing, which is worse than none because it looks fixed.
  itPostgresOnly(
    'invalidates a product under its concrete subtype, not the interface',
    async () => {
      const product = await createDirectProduct(app, {
        engagement: engagement.id,
      });
      const spy = watchInvalidations();

      await app.graphql.mutate(UpdateDirectProductDoc, { id: product.id });

      const keys = spy.mock.calls.map(([arg]) => keyOf(arg));
      expect(keys).toContain(`DirectScriptureProduct:${product.id}`);
      expect(keys).not.toContain(`Product:${product.id}`);
    },
  );
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

const UpdateDirectProductDoc = graphql(`
  mutation UpdateDirectProductForLiveQuery($id: ID!) {
    updateDirectScriptureProduct(input: { id: $id, describeCompletion: "lq" }) {
      product {
        id
      }
    }
  }
`);
