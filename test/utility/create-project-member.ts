import { gql } from 'graphql-tag';
import { isValidId } from '../../src/common';
import {
  CreateProjectMember,
  ProjectMember,
} from '../../src/components/project';
import {
  createPerson,
  createProject,
  fragments,
  Raw,
  TestApp,
} from '../utility';
import { getUserFromSession } from './create-session';

export async function listProjectMembers(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        projectMembers(input: {}) {
          items {
            ...projectMember
          }
        }
      }
      ${fragments.projectMember}
    `
  );
  const projectMembers = result.projectMembers.items;
  expect(projectMembers).toBeTruthy();
  return projectMembers;
}

export async function readOneProjectMember(app: TestApp, id: string) {
  const result = await app.graphql.query(
    gql`
      query ReadProjectMember($id: ID!) {
        projectMember(id: $id) {
          ...projectMember
        }
      }
      ${fragments.projectMember}
    `,
    { id }
  );

  const actual: ProjectMember = result.projectMember;
  expect(actual).toBeTruthy();
  expect(actual.id).toEqual(id);
  return actual;
}

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

  const actual: Raw<ProjectMember> = result.createProjectMember.projectMember;

  expect(actual).toBeTruthy();
  expect(isValidId(actual.id)).toBe(true);
  return actual;
}
