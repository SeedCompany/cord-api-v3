import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import {
  CreateProjectMember,
  ProjectMember,
} from '../../src/components/project';
import { createPerson, createProject, fragments, TestApp } from '../utility';
import { getUserFromSession } from './create-session';

export async function createProjectMember(
  app: TestApp,
  input: Partial<CreateProjectMember> = {}
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
  return actual;
}
