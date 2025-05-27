import { isValidId } from '~/common';
import { graphql } from '~/graphql';
import {
  type CreateProjectMember,
  type ProjectMember,
} from '../../src/components/project/project-member/dto';
import {
  createPerson,
  createProject,
  fragments,
  type Raw,
  type TestApp,
} from '../utility';
import { getUserFromSession } from './create-session';

export async function createProjectMember(
  app: TestApp,
  input: Partial<CreateProjectMember> = {},
) {
  const projectMember: CreateProjectMember = {
    userId:
      input.userId ||
      (await getUserFromSession(app)).id ||
      (await createPerson(app)).id,
    projectId: input.projectId ?? (await createProject(app)).id,
    ...input,
  };

  const result = await app.graphql.mutate(
    graphql(
      `
        mutation createProjectMember($input: CreateProjectMemberInput!) {
          createProjectMember(input: $input) {
            projectMember {
              ...projectMember
            }
          }
        }
      `,
      [fragments.projectMember],
    ),
    {
      input: {
        projectMember,
      },
    },
  );

  const actual: Raw<ProjectMember> = result.createProjectMember.projectMember;

  expect(actual).toBeTruthy();
  expect(isValidId(actual.id)).toBe(true);
  return actual;
}
