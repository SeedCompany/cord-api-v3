import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import {
  CreateProjectMember,
  ProjectMember,
  Role,
} from '../../src/components/project';
import { createProject, createUser, fragments, TestApp } from '../utility';

export async function createProjectMember(
  app: TestApp,
  input: Partial<CreateProjectMember> = {}
) {
  const projectMember: CreateProjectMember = {
    userId: input.userId ?? (await createUser(app)).id,
    projectId: input.projectId ?? (await createProject(app)).id,
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createProjectMember($input: CreateProjectMemberInput!) {
        createProjectMember(input: $input) {
          projectMember {
            ...projectMember
          }
        }
      }
      ${fragments.projectMember}
    `,
    {
      input: {
        projectMember,
      },
    }
  );

  const actual: ProjectMember = result.createProjectMember.projectMember;

  expect(actual).toBeTruthy();
  expect(isValid(actual.id)).toBe(true);
  expect(actual.roles.value).toEqual(
    expect.arrayContaining([Role.Admin]) //On Defaul Condition
  );
  return actual;
}
