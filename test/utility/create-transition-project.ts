import { gql } from 'apollo-server-core';
import { isValidId } from '../../src/common';
import { ProjectTransitionInput } from '../../src/components/project';
import { TestApp } from './create-app';

export async function createTransitionProject(
  app: TestApp,
  projectTransition: ProjectTransitionInput
) {
  const result = await app.graphql.mutate(
    gql`
      mutation transitionProject($input: ProjectTransitionInput!) {
        transitionProject(input: $input) {
          project {
            id
            step {
              canRead
              canEdit
              value
              transitions {
                to
                type
                label
              }
            }
          }
        }
      }
    `,
    {
      input: {
        ...projectTransition,
      },
    }
  );

  const actual = result.transitionProject.project;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
