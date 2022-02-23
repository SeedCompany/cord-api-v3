import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { isValidId } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { FieldRegion } from '../src/components/field-region';
import { FieldZone } from '../src/components/field-zone';
import { User } from '../src/components/user';
import {
  createSession,
  createTestApp,
  fragments,
  registerUserWithPower,
  TestApp,
} from './utility';
import { createRegion } from './utility/create-region';
import { createZone } from './utility/create-zone';

describe('Region e2e', () => {
  let app: TestApp;
  let director: User;
  let newDirector: User;
  let fieldZone: FieldZone;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    director = await registerUserWithPower(app, [Powers.CreateFieldZone]);
    fieldZone = await createZone(app, { directorId: director.id });
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a field region', async () => {
    const region = await createRegion(app, {
      directorId: director.id,
      fieldZoneId: fieldZone.id,
    });
    expect(region.id).toBeDefined();
  });

  it.skip('should have unique name', async () => {
    // Old test.  Attempt to create a region with a name that is taken will return the existing region
    const name = faker.address.country() + ' Region';
    await createRegion(app, {
      directorId: director.id,
      name,
      fieldZoneId: fieldZone.id,
    });
    await expect(
      createRegion(app, {
        directorId: director.id,
        name,
        fieldZoneId: fieldZone.id,
      })
    ).rejects.toThrowError();
  });

  it('read one field region by id', async () => {
    const fieldRegion = await createRegion(app, {
      directorId: director.id,
      fieldZoneId: fieldZone.id,
    });

    const { fieldRegion: actual } = await app.graphql.query(
      gql`
        query fieldRegion($id: ID!) {
          fieldRegion(id: $id) {
            ...fieldRegion
            director {
              value {
                ...user
              }
              canEdit
              canRead
            }
            fieldZone {
              value {
                ...fieldZone
              }
              canEdit
              canRead
            }
          }
        }
        ${fragments.fieldRegion}
        ${fragments.fieldZone}
        ${fragments.user}
      `,
      {
        id: fieldRegion.id,
      }
    );

    expect(actual.id).toBe(fieldRegion.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name).toEqual(fieldRegion.name);
    expect(actual.director.canEdit).toBe(true);
  });

  it('update field region', async () => {
    const fieldRegion = await createRegion(app, {
      directorId: director.id,
      fieldZoneId: fieldZone.id,
    });
    const newName = faker.company.companyName();

    const result = await app.graphql.mutate(
      gql`
        mutation updateFieldRegion($input: UpdateFieldRegionInput!) {
          updateFieldRegion(input: $input) {
            fieldRegion {
              ...fieldRegion
              director {
                value {
                  ...user
                }
                canEdit
                canRead
              }
              fieldZone {
                value {
                  ...fieldZone
                }
                canEdit
                canRead
              }
            }
          }
        }
        ${fragments.fieldRegion}
        ${fragments.fieldZone}
        ${fragments.user}
      `,
      {
        input: {
          fieldRegion: {
            id: fieldRegion.id,
            name: newName,
          },
        },
      }
    );
    const updated = result.updateFieldRegion.fieldRegion;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(fieldRegion.id);
    expect(updated.name.value).toBe(newName);
  });

  // This test should be updated with refactoring of location service for zone
  it.skip('update field region`s zone', async () => {
    const fieldRegion = await createRegion(app, { directorId: director.id });
    const newZone = await createZone(app, { directorId: newDirector.id });

    const result = await app.graphql.mutate(
      gql`
        mutation updateFieldRegion($input: UpdateFieldRegionInput!) {
          updateFieldRegion(input: $input) {
            fieldRegion {
              ...fieldRegion
              fieldZone {
                value {
                  ...fieldZone
                }
              }
            }
          }
        }
        ${fragments.fieldRegion}
        ${fragments.fieldZone}
      `,
      {
        input: {
          fieldRegion: {
            id: fieldRegion.id,
            zoneId: newZone.id,
          },
        },
      }
    );
    const updated = result.updateFieldRegion.fieldRegion;

    expect(updated).toBeTruthy();
    expect(updated.id).toBe(fieldRegion.id);
    expect(updated.fieldZone.value.id).toBe(newZone.id);
  });

  // This test should be updated with refactoring of location service for zone
  it.skip('update region`s director', async () => {
    const fieldRegion = await createRegion(app, { directorId: director.id });

    const result = await app.graphql.mutate(
      gql`
        mutation updateFieldRegion($input: UpdateFieldRegionInput!) {
          updateFieldRegion(input: $input) {
            fieldRegion {
              ...fieldRegion
              director {
                value {
                  ...user
                }
              }
            }
          }
        }
        ${fragments.fieldRegion}
        ${fragments.user}
      `,
      {
        input: {
          fieldRegion: {
            id: fieldRegion.id,
            directorId: newDirector.id,
          },
        },
      }
    );
    const updated = result.updateFieldregion.fieldRegion;

    expect(updated).toBeTruthy();
    expect(updated.id).toBe(fieldRegion.id);
    expect(updated.director.value.id).toBe(newDirector.id);
  });

  it.skip('delete region', async () => {
    const fieldRegion = await createRegion(app, {
      directorId: director.id,
      fieldZoneId: fieldZone.id,
    });

    const result = await app.graphql.mutate(
      gql`
        mutation deleteFieldRegion($id: ID!) {
          deleteFieldRegion(id: $id) {
            __typename
          }
        }
      `,
      {
        id: fieldRegion.id,
      }
    );
    const actual: FieldRegion | undefined = result.deleteFieldRegion;
    expect(actual).toBeTruthy();
  });

  it.skip('returns a list of regions', async () => {
    // create 2 regions with similar names
    await Promise.all(
      ['Western Mainlandia', 'Eastern Mainlandia'].map((regionName) =>
        createRegion(app, {
          name: regionName,
          directorId: director.id,
          fieldZoneId: fieldZone.id,
        })
      )
    );

    const { fieldRegions } = await app.graphql.query(gql`
      query {
        fieldRegions(input: { page: 1, count: 25 }) {
          items {
            ...fieldRegion
          }
          hasMore
          total
        }
      }
      ${fragments.fieldRegion}
    `);

    expect(fieldRegions.items.length).toBeGreaterThanOrEqual(2);
  });
});
