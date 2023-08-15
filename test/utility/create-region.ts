import { generateId, isValidId } from '~/common';
import {
  CreateFieldRegion,
  FieldRegion,
} from '../../src/components/field-region';
import { TestApp } from './create-app';
import { createPerson } from './create-person';
import { getUserFromSession } from './create-session';
import { createZone } from './create-zone';
import { fragments } from './fragments';
import { gql } from './gql-tag';
import { runAsAdmin } from './login';

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
