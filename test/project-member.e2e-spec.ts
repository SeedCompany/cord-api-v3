import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { isValid } from 'shortid';
import { ProjectMember, Role } from '../src/components/project';
import { User } from '../src/components/user';
import {
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  createUser,
  fragments,
  login,
  TestApp,
} from './utility';

describe('ProjectMember e2e', () => {
  let app: TestApp;
  let user: User;
  const password: string = faker.internet.password();

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    user = await createUser(app, { password });
  });
  afterAll(async () => {
    await app.close();
  });

  it('create projectMember', async () => {
    await login(app, { email: user.email.value, password });
    const projectMember = await createProjectMember(app, { userId: user.id });
    expect(projectMember.id).toBeDefined();
  });

  it('read one projectMember by id', async () => {
    const projectMember = await createProjectMember(app, { userId: user.id });
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
          roles: [Role.Consultant],
        })
      )
    );

    const { projectMembers } = await app.graphql.query(
      gql`
        query {
          projectMembers(input: { filter: { roles: [Consultant] } }) {
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
    await login(app, { email: user.email.value, password });
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

    await expect(
      app.graphql.query(
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
      )
    ).rejects.toThrowError();
  });

  it('update projectMember', async () => {
    const projectMember = await createProjectMember(app, { userId: user.id });

    const result = await app.graphql.query(
      gql`
        mutation updateProjectMember($input: UpdateProjectMemberInput!) {
          updateProjectMember(input: $input) {
            projectMember {
              ...projectMember
            }
          }
        }
        ${fragments.projectMember}
      `,
      {
        input: {
          projectMember: {
            id: projectMember.id,
            roles: [Role.Intern],
          },
        },
      }
    );

    expect(result.updateProjectMember.projectMember.id).toBe(projectMember.id);
    expect(result.updateProjectMember.projectMember.roles.value).toEqual(
      expect.arrayContaining([Role.Intern])
    );
  });
});
