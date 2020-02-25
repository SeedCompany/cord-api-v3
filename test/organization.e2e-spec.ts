import * as faker from 'faker';

import {
  TestApp,
  createOrganization,
  createSession,
  createTestApp,
  createUser,
  fragments,
} from './utility';

import { Organization } from '../src/components/organization';
import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import { times } from 'lodash';

describe('Organization e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // READ ORG
  it('create & read organization by id', async () => {
    const org = await createOrganization(app);

    const result = await app.graphql.query(
      gql`
        query org($id: ID!) {
          organization(id: $id) {
            ...org
          }
        }
        ${fragments.org}
      `,
      {
        id: org?.id,
      },
    );

    expect(result.organization.id).toBe(org?.id);
    expect(isValid(result.organization.id)).toBe(true);
    expect(result.organization.name.value).toBe(org?.name.value);
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
            id: org?.id,
            name: newName,
          },
        },
      },
    );

    const updated = result.updateOrganization?.organization;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(org?.id);
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
        id: org?.id,
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

    const result = await app.graphql.query(gql`
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

    expect(result.organizations.items.length).toBeGreaterThan(10);
  });
});
