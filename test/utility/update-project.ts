import { UpdateProject } from '../../src/components/project';
import { TestApp } from './create-app';
import { fragments } from './fragments';
import { gql } from './gql-tag';

export async function updateProject(app: TestApp, input: UpdateProject) {
  const result = await app.graphql.mutate(
    gql`
      mutation updateProject($input: UpdateProjectInput!) {
        updateProject(input: $input) {
          project {
            ...project
          }
        }
      }
      ${fragments.project}
    `,
    {
      input: {
        project: {
          ...input,
        },
      },
    },
  );

  const actual = result.updateProject.project;
  expect(actual).toBeTruthy();

  expect(actual.id).toBe(input.id);
  return actual;
}
