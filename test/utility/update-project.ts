import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function updateProject(app: TestApp, input: InputOf<typeof UpdateProjectDoc>) {
  const result = await app.graphql.mutate(UpdateProjectDoc, { input });

  const actual = result.updateProject.project;
  expect(actual).toBeTruthy();

  expect(actual.id).toBe(input.id);
  return actual;
}
const UpdateProjectDoc = graphql(
  `
    mutation UpdateProject($input: UpdateProject!) {
      updateProject(input: { project: $input }) {
        project {
          ...project
        }
      }
    }
  `,
  [fragments.project],
);
