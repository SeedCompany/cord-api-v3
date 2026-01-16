import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { isValidId, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createPerson,
  createRegion,
  createSession,
  createTestApp,
  createZone,
  fragments,
  loginAsAdmin,
  type TestApp,
} from './utility';

describe('Region e2e', () => {
  let app: TestApp;
  let director: fragments.user;
  let fieldZone: fragments.fieldZone;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);

    // Only admins can modify Field Regions
    await loginAsAdmin(app);

    director = await createPerson(app, {
      roles: [Role.RegionalDirector],
    });
    fieldZone = await createZone(app);
  });

  it('create a field region', async () => {
    const region = await createRegion(app, {
      director: director.id,
      fieldZone: fieldZone.id,
    });
    expect(region.id).toBeDefined();
  });

  it.skip('should have unique name', async () => {
    // Old test.  Attempt to create a region with a name that is taken will return the existing region
    const name = faker.location.country() + ' Region';
    await createRegion(app, {
      director: director.id,
      name,
      fieldZone: fieldZone.id,
    });
    await expect(
      createRegion(app, {
        director: director.id,
        name,
        fieldZone: fieldZone.id,
      }),
    ).rejects.toThrowGqlError();
  });

  it('read one field region by id', async () => {
    const fieldRegion = await createRegion(app, {
      director: director.id,
      fieldZone: fieldZone.id,
    });

    const { fieldRegion: actual } = await app.graphql.query(
      graphql(
        `
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
        `,
        [fragments.fieldRegion, fragments.fieldZone, fragments.user],
      ),
      {
        id: fieldRegion.id,
      },
    );

    expect(actual.id).toBe(fieldRegion.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name).toEqual(fieldRegion.name);
    expect(actual.director.canEdit).toBe(true);
  });

  it('update field region', async () => {
    const fieldRegion = await createRegion(app, {
      director: director.id,
      fieldZone: fieldZone.id,
    });

    const newName = faker.company.name();

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateFieldRegion($input: UpdateFieldRegion!) {
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
        `,
        [fragments.fieldRegion, fragments.fieldZone, fragments.user],
      ),
      {
        input: {
          id: fieldRegion.id,
          name: newName,
        },
      },
    );
    const updated = result.updateFieldRegion.fieldRegion;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(fieldRegion.id);
    expect(updated.name.value).toBe(newName);
  });

  // This test should be updated with refactoring of location service for zone
  it.skip('update field region`s zone', async () => {
    const fieldRegion = await createRegion(app, {
      director: director.id,
    });

    const newZone = await createZone(app, {
      director: director.id,
    });

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateFieldRegion($input: UpdateFieldRegion!) {
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
        `,
        [fragments.fieldRegion, fragments.fieldZone],
      ),
      {
        input: {
          id: fieldRegion.id,
          fieldZone: newZone.id,
        },
      },
    );
    const updated = result.updateFieldRegion.fieldRegion;

    expect(updated).toBeTruthy();
    expect(updated.id).toBe(fieldRegion.id);
    expect(updated.fieldZone.value!.id).toBe(newZone.id);
  });

  // This test should be updated with refactoring of location service for zone
  it.skip('update region`s director', async () => {
    const fieldRegion = await createRegion(app, { director: director.id });

    const newDirector = await createPerson(app, {
      roles: [Role.FieldOperationsDirector, Role.ProjectManager],
    });

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateFieldRegion($input: UpdateFieldRegion!) {
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
        `,
        [fragments.fieldRegion, fragments.user],
      ),
      {
        input: {
          id: fieldRegion.id,
          director: newDirector.id,
        },
      },
    );
    const updated = result.updateFieldRegion.fieldRegion;

    expect(updated).toBeTruthy();
    expect(updated.id).toBe(fieldRegion.id);
    expect(updated.director.value!.id).toBe(newDirector.id);
  });

  it.skip('delete region', async () => {
    const fieldRegion = await createRegion(app, {
      director: director.id,
      fieldZone: fieldZone.id,
    });

    const result = await app.graphql.mutate(
      graphql(`
        mutation deleteFieldRegion($id: ID!) {
          deleteFieldRegion(id: $id) {
            __typename
          }
        }
      `),
      {
        id: fieldRegion.id,
      },
    );
    const actual = result.deleteFieldRegion;
    expect(actual).toBeTruthy();
  });

  it.skip('returns a list of regions', async () => {
    // create 2 regions with similar names
    await Promise.all(
      ['Western Mainlandia', 'Eastern Mainlandia'].map((regionName) =>
        createRegion(app, {
          name: regionName,
          director: director.id,
          fieldZone: fieldZone.id,
        }),
      ),
    );

    const { fieldRegions } = await app.graphql.query(
      graphql(
        `
          query FieldRegions {
            fieldRegions(input: { page: 1, count: 25 }) {
              items {
                ...fieldRegion
              }
              hasMore
              total
            }
          }
        `,
        [fragments.fieldRegion],
      ),
    );

    expect(fieldRegions.items.length).toBeGreaterThanOrEqual(2);
  });
});
