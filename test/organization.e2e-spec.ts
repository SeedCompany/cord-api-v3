import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { orderBy, times } from 'lodash';
import { generateId, InputException, isValidId } from '../src/common';
import { Role } from '../src/components/authorization';
import { Powers } from '../src/components/authorization/dto/powers';
import { Organization } from '../src/components/organization';
import {
  createOrganization,
  createSession,
  createTestApp,
  fragments,
  registerUserWithPower,
  TestApp,
} from './utility';

describe('Organization e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUserWithPower(app, [Powers.CreateOrganization], {
      roles: [Role.Controller],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it.skip('should have unique name', async () => {
    const name = faker.company.companyName();
    await createOrganization(app, { name });
    await expect(createOrganization(app, { name })).rejects.toThrowError();
  });

  // READ ORG
  it('create & read organization by id', async () => {
    const org = await createOrganization(app);

    const { organization: actual } = await app.graphql.query(
      gql`
        query org($id: ID!) {
          organization(id: $id) {
            ...org
          }
        }
        ${fragments.org}
      `,
      {
        id: org.id,
      }
    );
    expect(actual.id).toBe(org.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name.value).toBe(org.name.value);
    expect(actual.address.value).toBe(org.address.value);
  });

  it('create & read organization by root security group member id', async () => {
    // should not run queries. everything should be graphql.
    // attach current user to rootsg
    // const currentUser = await getUserFromSession(app);
    // const db = app.get(DatabaseService);
    // await db
    //   .query()
    //   .match([node('user', 'User', { active: true, id: currentUser.id })])
    //   .create([
    //     node('user'),
    //     relation('in', '', 'member', { active: true }),
    //     node('rsg', 'RootSecurityGroup', { active: true }),
    //   ])
    //   .return('user')
    //   .first();
    const org = await createOrganization(app);
    const { organization: actual } = await app.graphql.query(
      gql`
        query org($id: ID!) {
          organization(id: $id) {
            ...org
          }
        }
        ${fragments.org}
      `,
      {
        id: org.id,
      }
    );
    expect(actual.id).toBe(org.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name.value).toBe(org.name.value);
  });

  it.skip('create organization with mandatory field blank, mismatch or removed', async () => {
    await expect(createOrganization(app, { name: '' })).rejects.toThrowError();
    await expect(
      createOrganization(app, { name: undefined })
    ).rejects.toThrowError();
  });

  it('read organization by root security group member id', async () => {
    await expect(
      app.graphql.query(
        gql`
          query org($id: ID!) {
            organization(id: $id) {
              ...org
            }
          }
          ${fragments.org}
        `,
        {
          id: '',
        }
      )
    ).rejects.toThrow('Input validation failed');

    await expect(
      app.graphql.query(
        gql`
          query org($id: ID!) {
            organization(id: $id) {
              ...org
            }
          }
          ${fragments.org}
        `,
        {
          id2: 'lKEsNY9FS',
        }
      )
    ).rejects.toThrowError();

    await expect(
      app.graphql.query(
        gql`
          query org($id: ID!) {
            organization(id: $id) {
              ...org
            }
          }
          ${fragments.org}
        `,
        {
          id: '!@#$%^&*(',
        }
      )
    ).rejects.toThrowError(new InputException('Input validation failed'));
  });

  // UPDATE ORG
  it('update organization', async () => {
    const org = await createOrganization(app);

    const newName = faker.company.companyName();

    const result = await app.graphql.mutate(
      gql`
        mutation updateOrganization($input: UpdateOrganizationInput!) {
          updateOrganization(input: $input) {
            organization {
              ...org
            }
          }
        }
        ${fragments.org}
      `,
      {
        input: {
          organization: {
            id: org.id,
            name: newName,
          },
        },
      }
    );

    const updated = result.updateOrganization.organization;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(org.id);
    expect(updated.name.value).toBe(newName);
  });

  it('update organization with blank, mismatch or invalid id', async () => {
    const newName = faker.company.companyName();

    await expect(
      app.graphql.mutate(
        gql`
          mutation updateOrganization($input: UpdateOrganizationInput!) {
            updateOrganization(input: $input) {
              organization {
                ...org
              }
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            organization: {
              id: '',
              name: newName,
            },
          },
        }
      )
    ).rejects.toThrowError(new InputException('Input validation failed'));

    await expect(
      app.graphql.mutate(
        gql`
          mutation updateOrganization($input: UpdateOrganizationInput!) {
            updateOrganization(input: $input) {
              organization {
                ...org
              }
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            organization: {
              id5: '',
              name: newName,
            },
          },
        }
      )
    ).rejects.toThrowError();

    await expect(
      app.graphql.mutate(
        gql`
          mutation updateOrganization($input: UpdateOrganizationInput!) {
            updateOrganization(input: $input) {
              organization {
                ...org
              }
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            organization: {
              id: '!@#$%^',
              name: newName,
            },
          },
        }
      )
    ).rejects.toThrowError(new InputException('Input validation failed'));
  });

  it.skip('update organization with mismatch name', async () => {
    const org = await createOrganization(app);

    const newName = faker.company.companyName();

    await expect(
      app.graphql.mutate(
        gql`
          mutation updateOrganization($input: UpdateOrganizationInput!) {
            updateOrganization(input: $input) {
              organization {
                ...org
              }
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            organization: {
              id: org.id,
              name2: newName,
            },
          },
        }
      )
    ).rejects.toThrowError();
  });

  // DELETE ORG
  it('delete organization', async () => {
    const org = await createOrganization(app);

    const result = await app.graphql.mutate(
      gql`
        mutation deleteOrganization($id: ID!) {
          deleteOrganization(id: $id) {
            __typename
          }
        }
      `,
      {
        id: org.id,
      }
    );

    const actual: Organization | undefined = result.deleteOrganization;
    expect(actual).toBeTruthy();
  });

  it('delete organization with blank, mismatch, invalid id', async () => {
    const org = await createOrganization(app);

    await expect(
      app.graphql.mutate(
        gql`
          mutation deleteOrganization($id: ID!) {
            deleteOrganization(id: $id) {
              __typename
            }
          }
        `,
        {
          id: '',
        }
      )
    ).rejects.toThrow('Input validation failed');

    await expect(
      app.graphql.mutate(
        gql`
          mutation deleteOrganization($id: ID!) {
            deleteOrganization(id: $id) {
              __typename
            }
          }
        `,
        {}
      )
    ).rejects.toThrowError();

    await expect(
      app.graphql.mutate(
        gql`
          mutation deleteOrganization($id: ID!) {
            deleteOrganization(id: $id) {
              __typename
            }
          }
        `,
        {
          id5: org.id,
        }
      )
    ).rejects.toThrowError();

    await expect(
      app.graphql.mutate(
        gql`
          mutation deleteOrganization($id: ID!) {
            deleteOrganization(id: $id) {
              __typename
            }
          }
        `,
        {
          id: '!@#$%',
        }
      )
    ).rejects.toThrow('Input validation failed');
  });

  it('shows canEdit true when it can be edited', async () => {
    // create an org
    const org = await createOrganization(app);

    const { organization: actual } = await app.graphql.query(
      gql`
        query org($id: ID!) {
          organization(id: $id) {
            ...org
          }
        }
        ${fragments.org}
      `,
      {
        id: org.id,
      }
    );

    expect(actual.name.canEdit).toBe(true);
  });

  it.skip('List of organizations sorted by name to be alphabetical, ignoring case sensitivity. Order: ASCENDING', async () => {
    await registerUserWithPower(app, [Powers.CreateOrganization], {
      displayFirstName: 'Tammy',
    });
    //Create three projects, each beginning with lower or upper-cases
    await createOrganization(app, {
      name: 'an Organization ' + faker.datatype.uuid(),
    });
    await createOrganization(app, {
      name: 'Another Organization' + faker.datatype.uuid(),
    });
    await createOrganization(app, {
      name: 'Big Organization' + faker.datatype.uuid(),
    });
    await createOrganization(app, {
      name: 'big Organization also' + faker.datatype.uuid(),
    });
    const sortBy = 'name';
    const ascOrder = 'ASC';
    const { organizations } = await app.graphql.query(
      gql`
        query organizations($input: OrganizationListInput!) {
          organizations(input: $input) {
            hasMore
            total
            items {
              id
              name {
                value
              }
            }
          }
        }
      `,
      {
        input: {
          sort: sortBy,
          order: ascOrder,
        },
      }
    );
    const items = organizations.items;
    const sorted = orderBy(items, (org) => org.name.value.toLowerCase(), [
      'asc',
    ]);
    expect(sorted).toEqual(items);
  });

  it.skip('List of organizations sorted by name to be alphabetical, ignoring case sensitivity. Order: DESCENDING', async () => {
    await registerUserWithPower(app, [Powers.CreateOrganization], {
      displayFirstName: 'Tammy',
    });
    //Create three projects, each beginning with lower or upper-cases
    await createOrganization(app, {
      name: 'an Organization ' + faker.datatype.uuid(),
    });
    await createOrganization(app, {
      name: 'Another Organization' + faker.datatype.uuid(),
    });
    await createOrganization(app, {
      name: 'Big Organization' + faker.datatype.uuid(),
    });
    await createOrganization(app, {
      name: 'big Organization also' + faker.datatype.uuid(),
    });
    const sortBy = 'name';
    const descOrder = 'DESC';
    const { organizations } = await app.graphql.query(
      gql`
        query organizations($input: OrganizationListInput!) {
          organizations(input: $input) {
            hasMore
            total
            items {
              id
              name {
                value
              }
            }
          }
        }
      `,
      {
        input: {
          sort: sortBy,
          order: descOrder,
        },
      }
    );
    const items = organizations.items;
    const sorted = orderBy(items, (org) => org.name.value.toLowerCase(), [
      'desc',
    ]);
    expect(sorted).toEqual(items);
  });

  it('list view of organizations with mismatch parameters', async () => {
    // create a bunch of orgs
    const numOrgs = 2;
    await Promise.all(
      times(numOrgs).map(
        async () =>
          await createOrganization(app, { name: (await generateId()) + ' Inc' })
      )
    );

    await expect(
      app.graphql.query(
        gql`
          query organizations($input: OrganizationListInput) {
            organizations(input: $input) {
              items {
                ...org
              }
              hasMore
              total
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            count1: 10,
            page: 1,
            sort: 'name',
            order: 'ASC',
            filter: {
              name: '',
            },
          },
        }
      )
    ).rejects.toThrowError();

    await expect(
      app.graphql.query(
        gql`
          query organizations($input: OrganizationListInput) {
            organizations(input: $input) {
              items {
                ...org
              }
              hasMore
              total
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            count: 10,
            page1: 1,
            sort: 'name',
            order: 'ASC',
            filter: {
              name: '',
            },
          },
        }
      )
    ).rejects.toThrowError();

    await expect(
      app.graphql.query(
        gql`
          query organizations($input: OrganizationListInput) {
            organizations(input: $input) {
              items {
                ...org
              }
              hasMore
              total
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            count: 10,
            page: 1,
            sort1: 'name',
            order: 'ASC',
            filter: {
              name: '',
            },
          },
        }
      )
    ).rejects.toThrowError();

    await expect(
      app.graphql.query(
        gql`
          query organizations($input: OrganizationListInput) {
            organizations(input: $input) {
              items {
                ...org
              }
              hasMore
              total
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            count: 10,
            page: 1,
            sort: 'name',
            order1: 'ASC',
            filter: {
              name: '',
            },
          },
        }
      )
    ).rejects.toThrowError();

    await expect(
      app.graphql.query(
        gql`
          query organizations($input: OrganizationListInput) {
            organizations(input: $input) {
              items {
                ...org
              }
              hasMore
              total
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            count: 10,
            page: 1,
            sort: 'name',
            order: 'ASC',
            filter1: {
              name: '',
            },
          },
        }
      )
    ).rejects.toThrowError();
  });

  it.skip('list view of organizations with invalid parameters', async () => {
    // create a bunch of orgs
    const numOrgs = 2;
    await Promise.all(
      times(numOrgs).map(
        async () =>
          await createOrganization(app, { name: (await generateId()) + ' Inc' })
      )
    );

    await expect(
      app.graphql.query(
        gql`
          query organizations($input: OrganizationListInput) {
            organizations(input: $input) {
              items {
                ...org
              }
              hasMore
              total
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            count: 0,
            page: 1,
            sort: 'name',
            order: 'ASC',
            filter: {
              name: '',
            },
          },
        }
      )
    ).rejects.toThrowError();

    await expect(
      app.graphql.query(
        gql`
          query organizations($input: OrganizationListInput) {
            organizations(input: $input) {
              items {
                ...org
              }
              hasMore
              total
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            count: 10,
            page: 0,
            sort: 'name',
            order: 'ASC',
            filter: {
              name: '',
            },
          },
        }
      )
    ).rejects.toThrowError();

    await expect(
      app.graphql.query(
        gql`
          query organizations($input: OrganizationListInput) {
            organizations(input: $input) {
              items {
                ...org
              }
              hasMore
              total
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            count: 10,
            page: 1,
            sort: 'abcd',
            order: 'ASC',
            filter: {
              name: '',
            },
          },
        }
      )
    ).rejects.toThrowError();

    await expect(
      app.graphql.query(
        gql`
          query organizations($input: OrganizationListInput) {
            organizations(input: $input) {
              items {
                ...org
              }
              hasMore
              total
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            count: 10,
            page: 1,
            sort: 'name',
            order: 'ASCENDING',
            filter: {
              name: '',
            },
          },
        }
      )
    ).rejects.toThrowError();

    await expect(
      app.graphql.query(
        gql`
          query organizations($input: OrganizationListInput) {
            organizations(input: $input) {
              items {
                ...org
              }
              hasMore
              total
            }
          }
          ${fragments.org}
        `,
        {
          input: {
            count: 10,
            page: 1,
            sort: 'name',
            order: 'ASC',
            filter1: {
              name: '',
            },
          },
        }
      )
    ).rejects.toThrowError();
  });
});
