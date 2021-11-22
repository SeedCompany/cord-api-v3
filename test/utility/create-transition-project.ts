import { gql } from 'apollo-server-core';
import { isValidId } from '../../src/common';
import { Project, ProjectTransitionInput } from '../../src/components/project';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createTransitionProject(
  app: TestApp,
  projectTransition: ProjectTransitionInput
) {
  const result = await app.graphql.mutate(
    gql`
      mutation transitionProject($input: ProjectTransitionInput!) {
        transitionProject(input: $input) {
          project {
            ...project
          }
        }
      }
      ${fragments.project}
    `,
    {
      input: {
        ...projectTransition,
      },
    }
  );

  const actual: Project = result.transitionProject.project;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
