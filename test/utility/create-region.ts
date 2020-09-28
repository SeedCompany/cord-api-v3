import { gql } from 'apollo-server-core';
import { generate, isValid } from 'shortid';
import { createPerson } from '.';
import {
  CreateFieldRegion,
  FieldRegion,
} from '../../src/components/field-region';
import { TestApp } from './create-app';
import { getUserFromSession } from './create-session';
import { createZone } from './create-zone';
import { fragments } from './fragments';

export async function createRegion(
  app: TestApp,
  input: Partial<CreateFieldRegion> = {}
) {
  const fieldRegion: CreateFieldRegion = {
    name: 'Region' + generate(),
    fieldZoneId: input.fieldZoneId || (await createZone(app)).id,
    directorId:
      input.directorId ||
      (await getUserFromSession(app)).id ||
      (await createPerson(app)).id,
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
    }
  );

  const actual: FieldRegion = result.createFieldRegion.fieldRegion;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.name.value).toBe(fieldRegion.name);

  return actual;
}
