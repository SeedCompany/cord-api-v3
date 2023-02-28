import { createPerson, runAsAdmin } from '.';
import { generateId, isValidId } from '../../src/common';
import {
  CreateFieldRegion,
  FieldRegion,
} from '../../src/components/field-region';
import { TestApp } from './create-app';
import { getUserFromSession } from './create-session';
import { createZone } from './create-zone';
import { fragments } from './fragments';
import { gql } from './gql-tag';

export async function listFieldRegions(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        fieldRegions(input: {}) {
          items {
            ...fieldRegion
          }
        }
      }
      ${fragments.fieldRegion}
    `,
  );
  const regions = result.fieldRegions.items;
  expect(regions).toBeTruthy();
  return regions;
}

export async function readOneRegion(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query readOneRegion($id: ID!) {
        fieldRegion(id: $id) {
          ...fieldRegion
        }
      }
      ${fragments.fieldRegion}
    `,
    { id },
  );
  const actual = result.fieldRegion;
  expect(actual).toBeTruthy();
  return actual;
}

export async function createRegion(
  app: TestApp,
  input: Partial<CreateFieldRegion> = {},
) {
  const fieldRegion: CreateFieldRegion = {
    name: 'Region' + (await generateId()),
    fieldZoneId:
      input.fieldZoneId ||
      (await runAsAdmin(app, async () => {
        return (await createZone(app)).id;
      })),

    directorId:
      input.directorId ||
      (await getUserFromSession(app)).id ||
      (await runAsAdmin(app, async () => {
        return (await createPerson(app)).id;
      })),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createFieldRegion($input: CreateFieldRegionInput!) {
        createFieldRegion(input: $input) {
          fieldRegion {
            ...fieldRegion
            fieldZone {
              value {
                ...fieldZone
              }
              canRead
              canEdit
            }
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
      ${fragments.fieldRegion}
      ${fragments.fieldZone}
      ${fragments.user}
    `,
    {
      input: {
        fieldRegion,
      },
    },
  );

  const actual: FieldRegion = result.createFieldRegion.fieldRegion;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(fieldRegion.name);

  return actual;
}
