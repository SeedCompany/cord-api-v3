import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { isValidId } from '../src/common';
import { FieldZone } from '../src/components/field-zone';
import { User } from '../src/components/user';
import {
  createSession,
  createTestApp,
  login,
  registerUser,
  TestApp,
} from './utility';
import { createZone } from './utility/create-zone';
import { fragments } from './utility/fragments';
import { resetDatabase } from './utility/reset-database';

describe('Field Zone e2e', () => {
  let app: TestApp;
  let director: User;
  const password: string = faker.internet.password();
  let db: Connection;

  let newDirector: User;
  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    director = await registerUser(app, { password });
    newDirector = await registerUser(app, { password });
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('create a field zone', async () => {
    await login(app, { email: director.email.value, password });
    const fieldZone = await createZone(app, { directorId: director.id });
    expect(fieldZone.id).toBeDefined();
  });

  it.skip('should have unique name', async () => {
    //old test.  now attempting to create a zone with a name that is taken will return the existing zone
    const name = faker.address.country() + ' Zone';
    await createZone(app, { directorId: director.id, name });
    await expect(
      createZone(app, { directorId: director.id, name })
    ).rejects.toThrowError();
  });

  it('read one field zone by id', async () => {
    const fieldZone = await createZone(app, { directorId: director.id });

    const { fieldZone: actual } = await app.graphql.query(
      gql`
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

        ${fragments.fieldZone}
        ${fragments.user}
      `,
      {
        id: fieldZone.id,
      }
    );

    expect(actual.id).toBe(fieldZone.id);
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name).toEqual(fieldZone.name);
    expect(actual.director.canEdit).toBe(true);
  });

  it('update field zone', async () => {
    const fieldZone = await createZone(app, { directorId: director.id });
    const newName = faker.company.companyName();

    const result = await app.graphql.mutate(
      gql`
        mutation updateFieldZone($input: UpdateFieldZoneInput!) {
          updateFieldZone(input: $input) {
            fieldZone {
              ...fieldZone
            }
          }
        }
        ${fragments.fieldZone}
      `,
      {
        input: {
          fieldZone: {
            id: fieldZone.id,
            name: newName,
          },
        },
      }
    );
    const updated = result.updateFieldZone.fieldZone;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(fieldZone.id);
    expect(updated.name.value).toBe(newName);
  });

  // This function in location service should be updated because one session couldn't be connected to several users at a time.
  it.skip("update field zone's director", async () => {
    const fieldZone = await createZone(app, { directorId: director.id });

    const result = await app.graphql.mutate(
      gql`
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
        ${fragments.fieldZone}
        ${fragments.user}
      `,
      {
        input: {
          fieldZone: {
            id: fieldZone.id,
            directorId: newDirector.id,
          },
        },
      }
    );
    const updated = result.updateFieldZone.fieldZone;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(fieldZone.id);
    expect(updated.director.value.id).toBe(newDirector.id);
  });

  it.skip('delete field zone', async () => {
    const fieldZone = await createZone(app, { directorId: director.id });

    const result = await app.graphql.mutate(
      gql`
        mutation deleteFieldRegion($id: ID!) {
          deleteFieldRegion(id: $id)
        }
      `,
      {
        id: fieldZone.id,
      }
    );
    const actual: FieldZone | undefined = result.deleteFieldRegion;

    expect(actual).toBeTruthy();
  });

  it.skip('returns a list of zones', async () => {
    // create 2 zones
    await Promise.all(
      ['Asia1', 'Asia2'].map((e) =>
        createZone(app, { name: e, directorId: director.id })
      )
    );

    const { fieldZones } = await app.graphql.query(gql`
      query {
        fieldZones(input: { filter: { page: 1, count: 25 } }) {
          items {
            ...fieldZone
          }
          hasMore
          total
        }
      }
      ${fragments.fieldZone}
    `);

    expect(fieldZones.items.length).toBeGreaterThanOrEqual(2);
  });
});
