import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { CalendarDate, isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type Tester } from '../setup';
import { fragments } from '../utility';

export const createProject =
  (input: Partial<InputOf<typeof CreateProjectDoc>> = {}) =>
  async (tester: Tester) => {
    const name = input.name ?? faker.lorem.word() + ' ' + faker.string.uuid();
    const type = input.type ?? 'MomentumTranslation';

    const result = await tester.run(CreateProjectDoc, {
      input: {
        mouStart: CalendarDate.fromISO('1991-01-01').toISO(),
        mouEnd: CalendarDate.fromISO('1992-01-01').toISO(),
        tags: ['tag1', 'tag2'],
        presetInventory: true,
        name,
        ...input,
        type,
      },
    });

    const actual = result.createProject.project;
    expect(actual).toBeTruthy();

    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name.value).toBe(name);
    expect(actual.type).toBe(type);

    return actual;
  };

const CreateProjectDoc = graphql(
  `
    mutation createProject($input: CreateProject!) {
      createProject(input: $input) {
        project {
          ...project
        }
      }
    }
  `,
  [fragments.project],
);
