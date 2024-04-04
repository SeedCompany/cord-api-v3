import { generateId, isValidId } from '~/common';
import {
  CreateFieldZone,
  FieldZone,
} from '../../src/components/field-zone/dto';
import { TestApp } from './create-app';
import { createPerson } from './create-person';
import { getUserFromSession } from './create-session';
import { fragments } from './fragments';
import { gql } from './gql-tag';
import { runAsAdmin } from './login';

export async function createZone(
  app: TestApp,
  input: Partial<CreateFieldZone> = {},
) {
  const fieldZone: CreateFieldZone = {
    name: 'Zone' + (await generateId()),
    directorId:
      input.directorId ||
      (await getUserFromSession(app)).id ||
      // don't want to have to declare the role at the top level. The person part doesn't really matter here.
      (await runAsAdmin(app, async () => {
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
    },
  );

  const actual: FieldZone = result.createFieldZone.fieldZone;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(fieldZone.name);

  return actual;
}
