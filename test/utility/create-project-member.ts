import { expect } from '@jest/globals';
import { isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { createProject, fragments, type TestApp } from '../utility';
import { getUserFromSession } from './create-session';

export async function createProjectMember(
  app: TestApp,
  input: Partial<InputOf<typeof CreateProjectMemberDoc>> = {},
) {
  const user = input.user || (await getUserFromSession(app)).id;
  const result = await app.graphql.mutate(CreateProjectMemberDoc, {
    input: {
      user,
      project: input.project ?? (await createProject(app)).id,
      ...input,
    },
  });

  const actual = result.createProjectMember.projectMember;

  expect(actual).toBeTruthy();
  expect(isValidId(actual.id)).toBe(true);
  return actual;
}

const CreateProjectMemberDoc = graphql(
  `
    mutation createProjectMember($input: CreateProjectMember!) {
      createProjectMember(input: { projectMember: $input }) {
        projectMember {
          ...projectMember
        }
      }
    }
  `,
  [fragments.projectMember],
);
