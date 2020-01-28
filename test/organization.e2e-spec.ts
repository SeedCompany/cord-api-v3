import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import {
  createOrganization,
  createTestApp,
  createToken,
  createUser,
  fragments,
  TestApp,
} from './utility';
import { times } from 'lodash';
import * as faker from 'faker';

describe('Organization e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
    await createToken(app);
    await createUser(app);
  });
  afterEach(async () => {
    await app.close();
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
      },
    );

    expect(actual.id).toBe(org.id);
    expect(isValid(actual.id)).toBe(true);
    expect(actual.name.value).toBe(org.name.value);
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
      },
    );
    const updated = result?.updateOrganization?.organization;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(org.id);
    expect(updated.name.value).toBe(newName);
  });

  // DELETE ORG
  it('delete organization', async () => {
    const org = await createOrganization(app);

    await app.graphql.mutate(
      gql`
        mutation deleteOrganization($id: ID!) {
          deleteOrganization(id: $id)
        }
      `,
      {
        id: org.id,
      },
    );
  });

  // LIST ORGs
  it('list view of organizations', async () => {
    // create a bunch of orgs
    const orgs = await Promise.all(
      times(10).map(() => createOrganization(app)),
    );

    const { organizations } = await app.graphql.query(gql`
      query {
        organizations {
          items {
            ...org
          }
          hasMore
          total
        }
      }
      ${fragments.org}
    `);

    expect(organizations.items).toHaveLength(orgs.length);
  });
});
