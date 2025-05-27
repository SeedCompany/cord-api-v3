import { graphql } from '~/graphql';
import { type UpdateProject } from '../../src/components/project/dto';
import { type TestApp } from './create-app';
import { fragments } from './fragments';

export async function updateProject(app: TestApp, input: UpdateProject) {
  const result = await app.graphql.mutate(
    graphql(
      `
        mutation updateProject($input: UpdateProjectInput!) {
          updateProject(input: $input) {
            project {
              ...project
            }
          }
        }
      `,
      [fragments.project],
    ),
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
