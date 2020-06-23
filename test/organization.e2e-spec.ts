import { gql } from 'apollo-server-core';
import { node, relation } from 'cypher-query-builder';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import { Organization } from '../src/components/organization';
import { DatabaseService } from '../src/core';
import {
  createOrganization,
  createSession,
  createTestApp,
  createUser,
  fragments,
  getUserFromSession,
  TestApp,
} from './utility';

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
    expect(isValid(actual.id)).toBe(true);
    expect(actual.name.value).toBe(org.name.value);
  });

  it('create & read organization by root security group member id', async () => {
    const currentUser = await getUserFromSession(app);
    const db = app.get(DatabaseService);
    // attach current user to rootsg
    await db
      .query()
      .match([node('user', 'User', { active: true, id: currentUser.id })])
      .create([
        node('user'),
        relation('in', '', 'member', { active: true }),
        node('rsg', 'RootSecurityGroup', { active: true }),
      ])
      .return('user')
      .first();
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
      }
    );

    const updated = result.updateOrganization.organization;
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
      }
    );

    const actual: Organization | undefined = result.deleteOrganization;
    expect(actual).toBeTruthy();
  });

  // LIST ORGs
  it.skip('list view of organizations', async () => {
    // create a bunch of orgs
    const numOrgs = 2;
    await Promise.all(
      times(numOrgs).map(() =>
        createOrganization(app, { name: generate() + ' Inc' })
      )
    );

    const { organizations } = await app.graphql.query(gql`
      query {
        organizations(input: { filter: { name: "Inc" } }) {
          items {
            ...org
          }
          hasMore
          total
        }
      }
      ${fragments.org}
    `);
    expect(organizations.items.length).toBeGreaterThan(numOrgs);
    expect(organizations.items[0].name.value).toBeTruthy();
  });

  it.skip('Check consistency across organization nodes', async () => {
    // create an organization
    const organization = await createOrganization(app);
    // test it has proper schema
    const result = await app.graphql.query(gql`
      query {
        checkOrganizationConsistency
      }
    `);
    expect(result.checkOrganizationConsistency).toBeTruthy();
    // delete organization node so next test will pass
    await app.graphql.mutate(
      gql`
        mutation deleteOrganization($id: ID!) {
          deleteOrganization(id: $id)
        }
      `,
      {
        id: organization.id,
      }
    );
  });

  it.skip('shows canEdit true when it can be edited', async () => {
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

  it('List view filters on name', async () => {
    const name = faker.commerce.productName();
    await createOrganization(app, { name });

    const { organizations } = await app.graphql.query(
      gql`
        query orgs($name: String!) {
          organizations(input: { filter: { name: $name } }) {
            items {
              ...org
            }
            hasMore
            total
          }
        }
        ${fragments.org}
      `,
      { name }
    );
    expect(organizations.total).toEqual(1);
    expect(organizations.items[0].name.value).toBe(name);
  });
});
