import { expect } from '@jest/globals';
import { generateId, isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import { createPerson } from './create-person';
import { createZone } from './create-zone';
import * as fragments from './fragments';
import { runAsAdmin } from './login';

export async function createRegion(
  app: TestApp,
  input: Partial<InputOf<typeof CreateFieldRegionDoc>> = {},
) {
  const name = input.name ?? 'Region' + (await generateId());
  const result = await app.graphql.mutate(CreateFieldRegionDoc, {
    input: {
      fieldZone:
        input.fieldZone ||
        (await runAsAdmin(app, async () => {
          return (await createZone(app)).id;
        })),

      director:
        input.director ||
        (await runAsAdmin(app, async () => {
          const director = await createPerson(app, {
            roles: ['RegionalDirector'],
          });
          return director.id;
        })),
      ...input,
      name,
    },
  });

  const actual = result.createFieldRegion.fieldRegion;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(name);

  return actual;
}

const CreateFieldRegionDoc = graphql(
  `
    mutation createFieldRegion($input: CreateFieldRegion!) {
      createFieldRegion(input: { fieldRegion: $input }) {
        fieldRegion {
          ...fieldRegion
        }
      }
    }
  `,
  [fragments.fieldRegion],
);
