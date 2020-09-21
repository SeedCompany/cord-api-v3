import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import { RegistryOfGeography } from '../src/components/registry-of-geography';
import {
  createRegistryOfGeography,
  createSession,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';

describe('RegistryOfGeography e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // Create Registry Of Geography
  it('create registry of geography', async () => {
    const name = faker.company.companyName();
    await createRegistryOfGeography(app, { name });
  });

  // Read Registry Of Geography
  it('create & read registry of geography by id', async () => {
    const st = await createRegistryOfGeography(app);

    const { registryOfGeography: actual } = await app.graphql.query(
      gql`
        query st($id: ID!) {
          registryOfGeography(id: $id) {
            ...registryOfGeography
          }
        }
        ${fragments.registryOfGeography}
      `,
      {
        id: st.id,
      }
    );
    expect(actual.id).toBe(st.id);
    expect(isValid(actual.id)).toBe(true);
    expect(actual.name.value).toBe(st.name.value);
    expect(actual.registryId.value).toBe(st.registryId.value);
  });

  // Update Registry Of Geography
  it('update registry of geography', async () => {
    const st = await createRegistryOfGeography(app);
    const newName = faker.company.companyName();
    const result = await app.graphql.mutate(
      gql`
        mutation updateRegistryOfGeography(
          $input: UpdateRegistryOfGeographyInput!
        ) {
          updateRegistryOfGeography(input: $input) {
            registryOfGeography {
              ...registryOfGeography
            }
          }
        }
        ${fragments.registryOfGeography}
      `,
      {
        input: {
          registryOfGeography: {
            id: st.id,
            name: newName,
          },
        },
      }
    );
    const updated = result.updateRegistryOfGeography.registryOfGeography;
    expect(updated).toBeTruthy();
    expect(updated.name.value).toBe(newName);
  });

  // Delete Registry Of Geography
  it.skip('delete registry of geography', async () => {
    const st = await createRegistryOfGeography(app);
    const result = await app.graphql.mutate(
      gql`
        mutation deleteRegistryOfGeography($id: ID!) {
          deleteRegistryOfGeography(id: $id)
        }
      `,
      {
        id: st.id,
      }
    );
    const actual: RegistryOfGeography | undefined =
      result.deleteRegistryOfGeography;
    expect(actual).toBeTruthy();
  });

  // List Registry Of Geographies
  it('list view of registry of geographies', async () => {
    // create a bunch of registry of geographies
    const numRegistryOfGeographies = 2;
    await Promise.all(
      times(numRegistryOfGeographies).map(() =>
        createRegistryOfGeography(app, {
          name: generate() + ' RegistryOfGeography',
        })
      )
    );

    const { registryOfGeographies } = await app.graphql.query(gql`
      query {
        registryOfGeographies(input: { count: 15 }) {
          items {
            ...registryOfGeography
          }
          hasMore
          total
        }
      }
      ${fragments.registryOfGeography}
    `);

    expect(registryOfGeographies.items.length).toBeGreaterThanOrEqual(
      numRegistryOfGeographies
    );
  });
});
