import { generateId, isValidId } from '~/common';
import { graphql } from '~/graphql';
import { type CreateFieldRegion } from '../../src/components/field-region/dto';
import { type TestApp } from './create-app';
import { createPerson } from './create-person';
import { createZone } from './create-zone';
import * as fragments from './fragments';
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
      (await runAsAdmin(app, async () => {
        const director = await createPerson(app, {
          roles: ['RegionalDirector'],
        });
        return director.id;
      })),
    ...input,
  };

  const result = await app.graphql.mutate(
    graphql(
      `
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
      `,
      [fragments.fieldRegion, fragments.fieldZone, fragments.user],
    ),
    {
      input: {
        fieldRegion,
      },
    },
  );

  const actual = result.createFieldRegion.fieldRegion;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(fieldRegion.name);

  return actual;
}
