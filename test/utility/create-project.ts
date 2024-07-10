import { faker } from '@faker-js/faker';
import { CalendarDate, isValidId } from '~/common';
import { CreateProject, ProjectType } from '../../src/components/project/dto';
import { TestApp } from './create-app';
import { createRegion } from './create-region';
import { fragments, RawProject } from './fragments';
import { gql } from './gql-tag';
import { runAsAdmin } from './login';

export async function createProject(
  app: TestApp,
  input: Partial<CreateProject> = {},
) {
  const project: CreateProject = {
    name: faker.lorem.word() + ' ' + faker.string.uuid(),
    type: ProjectType.MomentumTranslation,
    mouStart: CalendarDate.fromISO('1991-01-01'),
    mouEnd: CalendarDate.fromISO('1992-01-01'),
    tags: ['tag1', 'tag2'],
    fieldRegionId:
      input.fieldRegionId ||
      (await runAsAdmin(app, async () => {
        return (await createRegion(app)).id;
      })),
    presetInventory: true,
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createProject($input: CreateProjectInput!) {
        createProject(input: $input) {
          project {
            ...project
          }
        }
      }
      ${fragments.project}
    `,
    {
      input: {
        project,
      },
    },
  );

  const actual: RawProject = result.createProject.project;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);
  expect(actual.name.value).toBe(project.name);
  expect(actual.type).toBe(project.type);

  return actual;
}
