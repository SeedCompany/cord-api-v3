import { generateId, isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import { createPerson } from './create-person';
import * as fragments from './fragments';
import { runAsAdmin } from './login';

export async function createZone(
  app: TestApp,
  input: Partial<InputOf<typeof CreateFieldZoneDoc>> = {},
) {
  const name = input.name ?? 'Zone' + (await generateId());
  const result = await app.graphql.mutate(CreateFieldZoneDoc, {
    input: {
      directorId:
        input.directorId ||
        // don't want to have to declare the role at the top level. The person part doesn't really matter here.
        (await runAsAdmin(app, async () => {
          const director = await createPerson(app, {
            roles: ['FieldOperationsDirector'],
          });
          return director.id;
        })),
      ...input,
      name,
    },
  });

  const actual = result.createFieldZone.fieldZone;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(name);

  return actual;
}

const CreateFieldZoneDoc = graphql(
  `
    mutation createFieldZone($input: CreateFieldZone!) {
      createFieldZone(input: { fieldZone: $input }) {
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
  `,
  [fragments.fieldZone, fragments.user],
);
