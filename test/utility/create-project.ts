import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { CalendarDate, isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import { createRegion } from './create-region';
import * as fragments from './fragments';
import { runAsAdmin } from './login';

export async function createProject(
  app: TestApp,
  input: Partial<InputOf<typeof CreateProjectDoc>> = {},
) {
  const name = input.name ?? faker.lorem.word() + ' ' + faker.string.uuid();
  const type = input.type ?? 'MomentumTranslation';
  const result = await app.graphql.mutate(CreateProjectDoc, {
    input: {
      mouStart: CalendarDate.fromISO('1991-01-01').toISO(),
      mouEnd: CalendarDate.fromISO('1992-01-01').toISO(),
      tags: ['tag1', 'tag2'],
      fieldRegionId:
        input.fieldRegionId ||
        (await runAsAdmin(app, async () => {
          return (await createRegion(app)).id;
        })),
      presetInventory: true,
      ...input,
      name,
      type,
    },
  });

  const actual = result.createProject.project;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(name);
  expect(actual.type).toBe(type);

  return actual;
}

const CreateProjectDoc = graphql(
  `
    mutation createProject($input: CreateProject!) {
      createProject(input: { project: $input }) {
        project {
          ...project
        }
      }
    }
  `,
  [fragments.project],
);
