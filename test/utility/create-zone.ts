import { gql } from 'apollo-server-core';
import {
  createPerson,
  getUserFromSession,
  registerUser,
  runInIsolatedSession,
} from '.';
import { generateId, isValidId } from '../../src/common';
import { Role } from '../../src/components/authorization';
import { CreateFieldZone, FieldZone } from '../../src/components/field-zone';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function listFieldZones(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        fieldZones(input: {}) {
          items {
            ...fieldZone
          }
        }
      }
      ${fragments.fieldZone}
    `
  );
  const zones = result.fieldZones.items;
  expect(zones).toBeTruthy();
  return zones;
}

export async function readOneZone(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query readOneZone($id: ID!) {
        fieldZone(id: $id) {
          ...fieldZone
        }
      }
      ${fragments.fieldZone}
    `,
    { id }
  );
  const actual = result.fieldZone;
  expect(actual).toBeTruthy();
  return actual;
}

export async function createZone(
  app: TestApp,
  input: Partial<CreateFieldZone> = {}
) {
  const fieldZone: CreateFieldZone = {
    name: 'Zone' + (await generateId()),
    directorId:
      input.directorId ||
      (await getUserFromSession(app)).id ||
      (await runInIsolatedSession(app, async () => {
        await registerUser(app, { roles: [Role.Administrator] }); // don't want to have to declare the role at the top level. The person part doesn't really matter here.
        return (await createPerson(app)).id;
      })),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createFieldZone($input: CreateFieldZoneInput!) {
        createFieldZone(input: $input) {
          fieldZone {
            ...fieldZone
            director {
              value {
                ...user
              }
              canRead
              canEdit
            }
          }
        }
      }
      ${fragments.fieldZone}
      ${fragments.user}
    `,
    {
      input: {
        fieldZone,
      },
    }
  );

  const actual: FieldZone = result.createFieldZone.fieldZone;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(fieldZone.name);

  return actual;
}
