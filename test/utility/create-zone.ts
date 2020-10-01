import { gql } from 'apollo-server-core';
import { generate, isValid } from 'shortid';
import { createPerson, getUserFromSession } from '.';
import { CreateFieldZone, FieldZone } from '../../src/components/field-zone';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createZone(
  app: TestApp,
  input: Partial<CreateFieldZone> = {}
) {
  const fieldZone: CreateFieldZone = {
    name: 'Zone' + generate(),
    directorId:
      input.directorId ||
      (await getUserFromSession(app)).id ||
      (await createPerson(app)).id,
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

  expect(isValid(actual.id)).toBe(true);
  expect(actual.name.value).toBe(fieldZone.name);

  return actual;
}
