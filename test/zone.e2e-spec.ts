import { faker } from '@faker-js/faker';
import { times } from 'lodash';
import { isValidId } from '~/common';
import { graphql } from '~/graphql';
import {
  createPerson,
  createSession,
  createTestApp,
  createZone,
  fragments,
  loginAsAdmin,
  type TestApp,
} from './utility';

describe('Field Zone e2e', () => {
  let app: TestApp;
  let director: fragments.user;

  let newDirector: fragments.user;
  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    // Zones can only be created by admin
    await loginAsAdmin(app);

    director = await createPerson(app, {
      roles: ['FieldOperationsDirector'],
    });
    newDirector = await createPerson(app, {
      roles: ['FieldOperationsDirector'],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a field zone', async () => {
    const fieldZone = await createZone(app, { directorId: director.id });
    expect(fieldZone.id).toBeDefined();
  });

  it('should have unique name', async () => {
    //old test.  now attempting to create a zone with a name that is taken will return the existing zone
    const name = faker.location.country() + ' Zone';
    await createZone(app, { directorId: director.id, name });
    await expect(
      createZone(app, { directorId: director.id, name }),
    ).rejects.toThrowGqlError();
  });

  it('read one field zone by id', async () => {
    const fieldZone = await createZone(app, { directorId: director.id });

    const { fieldZone: actual } = await app.graphql.query(
      graphql(
        `
          query fieldZone($id: ID!) {
            fieldZone(id: $id) {
              ...fieldZone
              director {
                value {
                  ...user
                }
                canEdit
                canRead
              }
            }
          }
        `,
        [fragments.fieldZone, fragments.user],
      ),
      {
        id: fieldZone.id,
      },
    );

    expect(actual.id).toBe(fieldZone.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name).toEqual(fieldZone.name);
    expect(actual.director.canEdit).toBe(true);
  });

  it('update field zone', async () => {
    const fieldZone = await createZone(app, { directorId: director.id });
    const newName = faker.company.name();

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateFieldZone($input: UpdateFieldZoneInput!) {
            updateFieldZone(input: $input) {
              fieldZone {
                ...fieldZone
              }
            }
          }
        `,
        [fragments.fieldZone],
      ),
      {
        input: {
          fieldZone: {
            id: fieldZone.id,
            name: newName,
          },
        },
      },
    );
    const updated = result.updateFieldZone.fieldZone;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(fieldZone.id);
    expect(updated.name.value).toBe(newName);
  });

  // This function in location service should be updated because one session couldn't be connected to several users at a time.
  it("update field zone's director", async () => {
    const fieldZone = await createZone(app, { directorId: director.id });

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updateFieldZone($input: UpdateFieldZoneInput!) {
            updateFieldZone(input: $input) {
              fieldZone {
                ...fieldZone
                director {
                  value {
                    ...user
                  }
                }
              }
            }
          }
        `,
        [fragments.fieldZone, fragments.user],
      ),
      {
        input: {
          fieldZone: {
            id: fieldZone.id,
            directorId: newDirector.id,
          },
        },
      },
    );
    const updated = result.updateFieldZone.fieldZone;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(fieldZone.id);
    expect(updated.director.value!.id).toBe(newDirector.id);
  });

  it('delete field zone', async () => {
    const fieldZone = await createZone(app, { directorId: director.id });

    const result = await app.graphql.mutate(
      graphql(`
        mutation deleteFieldZone($id: ID!) {
          deleteFieldZone(id: $id) {
            __typename
          }
        }
      `),
      {
        id: fieldZone.id,
      },
    );
    const actual = result.deleteFieldZone;

    expect(actual).toBeTruthy();
  });

  it('returns a list of zones', async () => {
    // create 2 zones
    await Promise.all(
      times(2).map(
        async () => await createZone(app, { directorId: director.id }),
      ),
    );

    const { fieldZones } = await app.graphql.query(
      graphql(
        `
          query {
            fieldZones(input: { page: 1, count: 25 }) {
              items {
                ...fieldZone
              }
              hasMore
              total
            }
          }
        `,
        [fragments.fieldZone],
      ),
    );

    expect(fieldZones.items.length).toBeGreaterThanOrEqual(2);
  });
});
