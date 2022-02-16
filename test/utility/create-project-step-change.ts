import { gql } from 'apollo-server-core';
import { isValidId } from '../../src/common';
import { ProjectStepChangeInput } from '../../src/components/project';
import { TestApp } from './create-app';

export async function createProjectStepChange(
  app: TestApp,
  projectStepChange: ProjectStepChangeInput
) {
  const result = await app.graphql.mutate(
    gql`
      mutation transitionProject($input: ProjectStepChangeInput!) {
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
        ...projectStepChange,
      },
    }
  );

  const actual = result.transitionProject.project;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
