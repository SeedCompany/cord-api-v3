import { gql } from 'apollo-server-core';
import { times } from 'lodash';
import { isValid } from 'shortid';
import { ProjectMember, Role } from '../src/components/project-member';
import { User } from '../src/components/user';
import {
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';

describe('ProjectMember e2e', () => {
  let app: TestApp;
  let user: User;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    user = await createUser(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('create projectMember', async () => {
    const projectMember = await createProjectMember(app, { userId: user.id });
    expect(projectMember.id).toBeDefined();
  });

  it('read one projectMember by id', async () => {
    const projectMember = await createProjectMember(app, { userId: user.id });
    try {
      const result = await app.graphql.query(
        gql`
          query projectMember($id: ID!) {
            projectMember(id: $id) {
              ...projectMember
            }
          }
          ${fragments.projectMember}
        `,
        {
          id: projectMember.id,
        }
      );

      const actual: ProjectMember = result.projectMember;
      expect(actual.id).toBe(projectMember.id);
      expect(isValid(actual.id)).toBe(true);
      expect(actual.user.value?.id).toBe(user.id);
    } catch (e) {
      console.error(e);
      fail();
    }
  });

  it('list view of ProjectMember', async () => {
    const numProjectMembers = 10;
    const userForList = await createUser(app);
    const projectForList = await createProject(app);

    const userId = userForList.id;
    const projectId = projectForList.id;

    await Promise.all(
      times(numProjectMembers).map(() =>
        createProjectMember(app, {
          userId,
          projectId,
        })
      )
    );

    const { projectMembers } = await app.graphql.query(
      gql`
        query {
          projectMembers(input: { filter: { roles: [Admin] } }) {
            items {
              id
            }
            hasMore
            total
          }
        }
      `
    );
    expect(projectMembers.items.length).toBeGreaterThanOrEqual(
      numProjectMembers
    );
  });

  it('delete projectMember', async () => {
    const projectMember = await createProjectMember(app, { userId: user.id });

    const result = await app.graphql.mutate(
      gql`
        mutation deleteProjectMember($id: ID!) {
          deleteProjectMember(id: $id)
        }
      `,
      {
        id: projectMember.id,
      }
    );

    const actual: boolean | undefined = result.deleteProjectMember;
    expect(actual).toBeTruthy();

    try {
      await app.graphql.query(
        gql`
          query projectMember($id: ID!) {
            projectMember(id: $id) {
              ...projectMember
            }
          }
          ${fragments.projectMember}
        `,
        {
          id: projectMember.id,
        }
      );
    } catch (e) {
      expect(e.response.statusCode).toBe(404);
    }
  });

  it('update projectMember', async () => {
    const projectMember = await createProjectMember(app, { userId: user.id });

    const result = await app.graphql.query(
      gql`
        mutation updateProjectMember($id: ID!) {
          updateProjectMember(
            input: { projectMember: { id: $id, roles: Intern } }
          ) {
            projectMember {
              ...projectMember
            }
          }
        }
        ${fragments.projectMember}
      `,
      {
        id: projectMember.id,
      }
    );

    expect(result.updateProjectMember.projectMember.id).toBe(projectMember.id);
    expect(result.updateProjectMember.projectMember.roles.value).toEqual(
      expect.arrayContaining([Role.Intern]) //On Defaul Condition
    );
  });
});
