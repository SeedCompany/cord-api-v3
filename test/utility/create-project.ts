import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { isValid } from 'shortid';
import { CalendarDate } from '../../src/common';
import {
  CreateProject,
  Project,
  ProjectStep,
  ProjectType,
} from '../../src/components/project';
import { TestApp } from './create-app';
import { fragments } from './fragments';
import { Raw } from './raw.type';

export async function createProject(
  app: TestApp,
  input: Partial<CreateProject> = {}
) {
  const project: CreateProject = {
    name: faker.random.uuid(),
    type: ProjectType.Translation,
    mouStart: CalendarDate.fromISO('1991-01-01'),
    mouEnd: CalendarDate.fromISO('1992-01-01'),
    step: ProjectStep.PendingConceptApproval,
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
    }
  );

  const actual: Raw<Project> = result.createProject.project;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.name.value).toBe(project.name);
  expect(actual.type).toBe(project.type);

  return actual;
}
