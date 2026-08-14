import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { times } from 'lodash';
import { generateId, type ID, isValidId, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createLocation,
  createOrganization,
  createSession,
  createTestApp,
  errors,
  fragments,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';

describe('Organization e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [Role.Controller],
    });
  });

  it.skip('should have unique name', async () => {
    const name = faker.company.name();
    await createOrganization(app, { name });
    await expect(createOrganization(app, { name })).rejects.toThrowGqlError();
  });

  // READ ORG
  it('create & read organization by id', async () => {
    const org = await createOrganization(app);

    const { organization: actual } = await app.graphql.query(
      graphql(
        `
          query org($id: ID!) {
            organization(id: $id) {
              ...org
            }
          }
        `,
        [fragments.org],
      ),
      {
        id: org.id,
      },
    );
    expect(actual.id).toBe(org.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name.value).toBe(org.name.value);
    expect(actual.address.value).toBe(org.address.value);
  });

  it('create & read organization', async () => {
    const org = await createOrganization(app);
    const { organization: actual } = await app.graphql.query(
      graphql(
        `
          query org($id: ID!) {
            organization(id: $id) {
              ...org
            }
          }
        `,
        [fragments.org],
      ),
      {
        id: org.id,
      },
    );
    expect(actual.id).toBe(org.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name.value).toBe(org.name.value);
  });

  it.skip('create organization with mandatory field blank, mismatch or removed', async () => {
    await expect(
      createOrganization(app, { name: '' }),
    ).rejects.toThrowGqlError();
    await expect(
      createOrganization(app, { name: undefined }),
    ).rejects.toThrowGqlError();
  });

  // UPDATE ORG
  it('update organization', async () => {
    const org = await createOrganization(app);

    const newName = faker.company.name();

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateOrganization($input: UpdateOrganization!) {
            updateOrganization(input: $input) {
              organization {
                ...org
              }
            }
          }
        `,
        [fragments.org],
      ),
      {
        input: {
          id: org.id,
          name: newName,
        },
      },
    );

    const updated = result.updateOrganization.organization;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(org.id);
    expect(updated.name.value).toBe(newName);
  });

  it('update organization with blank, mismatch or invalid id', async () => {
    const newName = faker.company.name();

    await app.graphql
      .mutate(
        graphql(
          `
            mutation updateOrganization($input: UpdateOrganization!) {
              updateOrganization(input: $input) {
                organization {
                  ...org
                }
              }
            }
          `,
          [fragments.org],
        ),
        {
          input: {
            id: '' as ID,
            name: newName,
          },
        },
      )
      .expectError(errors.invalidId('id'));

    await app.graphql
      .mutate(
        graphql(
          `
            mutation updateOrganization($input: UpdateOrganization!) {
              updateOrganization(input: $input) {
                organization {
                  ...org
                }
              }
            }
          `,
          [fragments.org],
        ),
        {
          input: {
            // @ts-expect-error confirming runtime error here
            id5: '',
            name: newName,
          },
        },
      )
      .expectError();

    await app.graphql
      .mutate(
        graphql(
          `
            mutation updateOrganization($input: UpdateOrganization!) {
              updateOrganization(input: $input) {
                organization {
                  ...org
                }
              }
            }
          `,
          [fragments.org],
        ),
        {
          input: {
            id: '!@#$%^' as ID,
            name: newName,
          },
        },
      )
      .expectError(errors.invalidId('id'));
  });

  it.skip('update organization with mismatch name', async () => {
    const org = await createOrganization(app);

    const newName = faker.company.name();

    await app.graphql
      .mutate(
        graphql(
          `
            mutation updateOrganization($input: UpdateOrganization!) {
              updateOrganization(input: $input) {
                organization {
                  ...org
                }
              }
            }
          `,
          [fragments.org],
        ),
        {
          input: {
            id: org.id,
            // @ts-expect-error confirming runtime error here
            name2: newName,
          },
        },
      )
      .expectError();
  });

  // DELETE ORG
  it('delete organization', async () => {
    const org = await createOrganization(app);

    const result = await app.graphql.mutate(
      graphql(`
        mutation deleteOrganization($id: ID!) {
          deleteOrganization(id: $id) {
            __typename
          }
        }
      `),
      {
        id: org.id,
      },
    );

    const actual = result.deleteOrganization;
    expect(actual).toBeTruthy();
  });

  it('delete organization with blank, mismatch, invalid id', async () => {
    const org = await createOrganization(app);

    const DeleteOrganization = graphql(`
      mutation deleteOrganization($id: ID!) {
        deleteOrganization(id: $id) {
          __typename
        }
      }
    `);
    await app.graphql
      .mutate(DeleteOrganization, { id: '' as ID })
      .expectError(errors.invalidId());

    // @ts-expect-error confirming runtime error here
    await app.graphql.mutate(DeleteOrganization).expectError(errors.schema());

    await app.graphql
      // @ts-expect-error confirming runtime error here
      .mutate(DeleteOrganization, { id5: org.id })
      .expectError(errors.schema());

    await app.graphql
      .mutate(DeleteOrganization, { id: '!@#$%' as ID })
      .expectError(errors.invalidId());
  });

  it('shows canEdit true when it can be edited', async () => {
    // create an org
    const org = await createOrganization(app);

    const { organization: actual } = await app.graphql.query(
      graphql(
        `
          query org($id: ID!) {
            organization(id: $id) {
              ...org
            }
          }
        `,
        [fragments.org],
      ),
      {
        id: org.id,
      },
    );

    expect(actual.name.canEdit).toBe(true);
  });

  it('adds and removes a location from an organization', async () => {
    const org = await createOrganization(app);
    const location = await runAsAdmin(app, () => createLocation(app));

    const OrgLocations = graphql(`
      query org($id: ID!) {
        organization(id: $id) {
          locations {
            items {
              id
            }
          }
        }
      }
    `);

    await app.graphql.mutate(
      graphql(`
        mutation addLocationToOrganization($organization: ID!, $location: ID!) {
          addLocationToOrganization(
            organization: $organization
            location: $location
          ) {
            id
          }
        }
      `),
      { organization: org.id, location: location.id },
    );

    const afterAdd = await app.graphql.query(OrgLocations, { id: org.id });
    expect(afterAdd.organization.locations.items.map((l) => l.id)).toEqual([
      location.id,
    ]);

    await app.graphql.mutate(
      graphql(`
        mutation removeLocationFromOrganization(
          $organization: ID!
          $location: ID!
        ) {
          removeLocationFromOrganization(
            organization: $organization
            location: $location
          ) {
            id
          }
        }
      `),
      { organization: org.id, location: location.id },
    );

    const afterRemove = await app.graphql.query(OrgLocations, { id: org.id });
    expect(afterRemove.organization.locations.items).toHaveLength(0);
  });

  const Organizations = graphql(`
    query organizations($input: OrganizationListInput) {
      organizations(input: $input) {
        items {
          id
          name {
            value
          }
        }
        hasMore
        total
      }
    }
  `);
  /**
   * Seeds four organizations whose names differ ONLY in the case of the first
   * letter after a shared random prefix — no spaces, digits or punctuation. That
   * keeps the assertion about case folding and nothing else: every collation
   * that folds case agrees on `alpha, Bravo, charlie, Delta`, while a
   * case-sensitive byte sort gives a visibly different `Bravo, Delta, alpha,
   * charlie`. Names containing spaces would instead be testing how the collation
   * weights punctuation, which is a separate question with a different answer
   * per collation.
   *
   * Inserted in an order matching neither the expected ascending nor descending
   * result, so a repository that drops `sort` on the floor cannot pass by luck.
   */
  const seedCaseVariants = async () => {
    const prefix = faker.string.alpha({ length: 10, casing: 'lower' });
    const ascendingSuffixes = ['alpha', 'Bravo', 'charlie', 'Delta'];
    for (const suffix of ['charlie', 'Delta', 'alpha', 'Bravo']) {
      await createOrganization(app, { name: prefix + suffix });
    }
    return {
      prefix,
      expectedAsc: ascendingSuffixes.map((suffix) => prefix + suffix),
    };
  };

  /**
   * Collects every visible organization name in the order the API returns them.
   *
   * Two reasons this pages instead of asking for one big page or using the
   * `name` filter:
   *   - `count` is capped at 100, and the shared Neo4j test database accumulates
   *     organizations across spec files, so one page is not guaranteed to hold
   *     the seeded four.
   *   - the `name` filter is NOT equivalent across engines — Neo4j reaches a
   *     Lucene full-text index (a synthetic prefix glued to a word is one token,
   *     which an unanchored term query will not match) while Postgres runs a
   *     substring ILIKE. Filtering server-side would have the two engines
   *     comparing different result sets, which is the opposite of what a parity
   *     test should do.
   *
   * Bounded, and throws rather than silently returning a partial list.
   */
  const allOrgNamesInOrder = async (order: 'ASC' | 'DESC') => {
    const maxPages = 25;
    const names: string[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      if (page > maxPages) {
        throw new Error(
          `organization list did not terminate within ${maxPages} pages — raise the bound or narrow the query`,
        );
      }
      const { organizations } = await app.graphql.query(Organizations, {
        input: { sort: 'name', order, count: 100, page },
      });
      names.push(
        ...organizations.items
          .map((org) => org.name.value)
          .filter((name): name is string => !!name),
      );
      hasMore = organizations.hasMore;
      page++;
    }
    return names;
  };

  it('sorts organizations by name ignoring case, ascending', async () => {
    const { prefix, expectedAsc } = await seedCaseVariants();

    const seeded = (await allOrgNamesInOrder('ASC')).filter((name) =>
      name.startsWith(prefix),
    );

    // Check the set before the order: if the seeds went missing, this fails
    // loudly instead of the order assertion quietly passing on a subset.
    expect(seeded).toHaveLength(expectedAsc.length);
    expect(seeded).toEqual(expectedAsc);
  });

  it('sorts organizations by name ignoring case, descending', async () => {
    const { prefix, expectedAsc } = await seedCaseVariants();

    const seeded = (await allOrgNamesInOrder('DESC')).filter((name) =>
      name.startsWith(prefix),
    );

    expect(seeded).toHaveLength(expectedAsc.length);
    expect(seeded).toEqual([...expectedAsc].reverse());
  });

  it('list view of organizations with mismatch parameters', async () => {
    // create a bunch of orgs
    const numOrgs = 2;
    await Promise.all(
      times(numOrgs).map(
        async () =>
          await createOrganization(app, {
            name: (await generateId()) + ' Inc',
          }),
      ),
    );

    await app.graphql
      .query(Organizations, {
        // @ts-expect-error confirming runtime error here
        input: { count1: 10 },
      })
      .expectError();

    await app.graphql
      .query(Organizations, {
        // @ts-expect-error confirming runtime error here
        input: { page1: 1 },
      })
      .expectError();

    await app.graphql
      .query(Organizations, {
        // @ts-expect-error confirming runtime error here
        input: { sort1: 'name' },
      })
      .expectError();

    await app.graphql
      .query(Organizations, {
        input: {
          // @ts-expect-error confirming runtime error here
          order1: 'ASC',
        },
      })
      .expectError();

    await app.graphql
      .query(Organizations, {
        input: {
          // @ts-expect-error confirming runtime error here
          filter1: {
            name: '',
          },
        },
      })
      .expectError();
  });

  it.skip('list view of organizations with invalid parameters', async () => {
    // create a bunch of orgs
    const numOrgs = 2;
    await Promise.all(
      times(numOrgs).map(
        async () =>
          await createOrganization(app, {
            name: (await generateId()) + ' Inc',
          }),
      ),
    );

    await app.graphql
      .query(Organizations, {
        input: { count: 0 },
      })
      .expectError();

    await app.graphql
      .query(Organizations, {
        input: { page: 0 },
      })
      .expectError();

    await app.graphql
      .query(Organizations, {
        input: { sort: 'abcd' },
      })
      .expectError();

    await app.graphql
      .query(Organizations, {
        input: {
          // @ts-expect-error confirming runtime error here
          order: 'ASCENDING',
        },
      })
      .expectError();

    await app.graphql
      .query(Organizations, {
        input: {
          // @ts-expect-error confirming runtime error here
          filter1: {
            name: '',
          },
        },
      })
      .expectError();
  });
});
