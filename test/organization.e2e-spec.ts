import * as faker from 'faker';

import {
  TestApp,
  createOrganization,
  createTestApp,
  createToken,
  createUser,
  fragments,
} from './utility';

import { Organization } from '../src/components/organization';
import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import { times } from 'lodash';

describe('Organization e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
    await createToken(app);
    await createUser(app);
  });

  afterAll(async () => {
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

    const result = await app.graphql.mutate(
      gql`
        mutation deleteOrganization($id: ID!) {
          deleteOrganization(id: $id)
        }
      `,
      {
        id: org.id,
      },
    );

    const actual: Organization | undefined = result.deleteOrganization;
    expect(actual).toBeTruthy();
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
    
    expect(organizations.items.length).toBeGreaterThan(10);
  });
});
