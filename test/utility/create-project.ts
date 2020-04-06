import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { isValid } from 'shortid';
import {
  CreateProject,
  Project,
  ProjectType,
} from '../../src/components/project';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createProject(
  app: TestApp,
  input: Partial<CreateProject> = {}
) {
  const project: CreateProject = {
    name: faker.random.uuid(),
    type: ProjectType.Translation,
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

  const actual: Project = result.createProject.project;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);
  expect(actual.name.value).toBe(project.name);
  expect(actual.type).toBe(project.type);

  return actual;
}
