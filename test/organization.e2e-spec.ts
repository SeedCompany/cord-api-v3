import { faker } from '@faker-js/faker';
import { sortBy } from '@seedcompany/common';
import { times } from 'lodash';
import { generateId, type ID, isValidId, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createOrganization,
  createSession,
  createTestApp,
  errors,
  fragments,
  registerUser,
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

  afterAll(async () => {
    await app.close();
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
    await expect(createOrganization(app, { name: '' })).rejects.toThrowGqlError();
    await expect(createOrganization(app, { name: undefined })).rejects.toThrowGqlError();
  });

  // UPDATE ORG
  it('update organization', async () => {
    const org = await createOrganization(app);

    const newName = faker.company.name();

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateOrganization($input: UpdateOrganizationInput!) {
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
          organization: {
            id: org.id,
            name: newName,
          },
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
            mutation updateOrganization($input: UpdateOrganizationInput!) {
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
            organization: {
              id: '' as ID,
              name: newName,
            },
          },
        },
      )
      .expectError(errors.invalidId('organization.id'));

    await app.graphql
      .mutate(
        graphql(
          `
            mutation updateOrganization($input: UpdateOrganizationInput!) {
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
            organization: {
              // @ts-expect-error confirming runtime error here
              id5: '',
              name: newName,
            },
          },
        },
      )
      .expectError();

    await app.graphql
      .mutate(
        graphql(
          `
            mutation updateOrganization($input: UpdateOrganizationInput!) {
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
            organization: {
              id: '!@#$%^' as ID,
              name: newName,
            },
          },
        },
      )
      .expectError(errors.invalidId('organization.id'));
  });

  it.skip('update organization with mismatch name', async () => {
    const org = await createOrganization(app);

    const newName = faker.company.name();

    await app.graphql
      .mutate(
        graphql(
          `
            mutation updateOrganization($input: UpdateOrganizationInput!) {
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
            organization: {
              id: org.id,
              // @ts-expect-error confirming runtime error here
              name2: newName,
            },
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
    await app.graphql.mutate(DeleteOrganization, { id: '' as ID }).expectError(errors.invalidId());

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
  it.skip('List of organizations sorted by name to be alphabetical, ignoring case sensitivity. Order: ASCENDING', async () => {
    await registerUser(app, {
      roles: [Role.FieldOperationsDirector],
      displayFirstName: 'Tammy',
    });
    //Create three projects, each beginning with lower or upper-cases
    await createOrganization(app, {
      name: 'an Organization ' + faker.string.uuid(),
    });
    await createOrganization(app, {
      name: 'Another Organization' + faker.string.uuid(),
    });
    await createOrganization(app, {
      name: 'Big Organization' + faker.string.uuid(),
    });
    await createOrganization(app, {
      name: 'big Organization also' + faker.string.uuid(),
    });
    const { organizations } = await app.graphql.query(Organizations, {
      input: {
        sort: 'name',
        order: 'ASC',
      },
    });
    const items = organizations.items;
    const sorted = sortBy(items, (org: any) => org.name.value.toLowerCase());
    expect(sorted).toEqual(items);
  });

  it.skip('List of organizations sorted by name to be alphabetical, ignoring case sensitivity. Order: DESCENDING', async () => {
    await registerUser(app, {
      roles: [Role.FieldOperationsDirector],
      displayFirstName: 'Tammy',
    });
    //Create three projects, each beginning with lower or upper-cases
    await createOrganization(app, {
      name: 'an Organization ' + faker.string.uuid(),
    });
    await createOrganization(app, {
      name: 'Another Organization' + faker.string.uuid(),
    });
    await createOrganization(app, {
      name: 'Big Organization' + faker.string.uuid(),
    });
    await createOrganization(app, {
      name: 'big Organization also' + faker.string.uuid(),
    });
    const { organizations } = await app.graphql.query(Organizations, {
      input: {
        sort: 'name',
        order: 'DESC',
      },
    });
    const items = organizations.items;
    const sorted = sortBy(items, [(org: any) => org.name.value.toLowerCase(), 'desc']);
    expect(sorted).toEqual(items);
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
