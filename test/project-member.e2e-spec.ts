import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { DateTime, Interval } from 'luxon';
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
    const project = await createProject(app);
    const member = await createUser(app, { password });
    const projectMember = await createProjectMember(app, {
      userId: member.id,
      projectId: project.id,
    });
    expect(projectMember.id).toBeDefined();
    expect(projectMember.modifiedAt).toBeDefined();
    const difference = Interval.fromDateTimes(
      DateTime.fromISO(projectMember.modifiedAt.toString()),
      DateTime.local()
    )
      .toDuration()
      .toFormat('S');
    expect(parseInt(difference)).toBeGreaterThan(0);
  });

  it('read one projectMember by id', async () => {
    await login(app, { email: user.email.value, password });
    const project = await createProject(app);
    const member = await createUser(app, { password });
    const projectMember = await createProjectMember(app, {
      userId: member.id,
      projectId: project.id,
    });
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
    expect(actual.user.value?.id).toBe(member.id);
  });

  it.skip('list view of ProjectMember', async () => {
    const numProjectMembers = 2;
    const userForList = await createUser(app, { password });
    const userId = userForList.id;
    const projectIds: string[] = [];

    await Promise.all(
      times(numProjectMembers).map(async () => {
        await createUser(app);
        const project = await createProject(app);
        projectIds.push(project.id);
      })
    );

    await login(app, { email: userForList.email.value, password });

    await Promise.all(
      times(numProjectMembers, async (index) => {
        await createProjectMember(app, {
          userId: userId,
          projectId: projectIds[index],
          roles: [Role.Consultant],
        });
      })
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
    const project = await createProject(app);
    const member = await createUser(app, { password });
    const projectMember = await createProjectMember(app, {
      userId: member.id,
      projectId: project.id,
    });

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

  it('Can create the same projectMember after deletion', async () => {
    await login(app, { email: user.email.value, password });
    const project = await createProject(app);
    const member = await createUser(app, { password });
    const projectMember = await createProjectMember(app, {
      userId: member.id,
      projectId: project.id,
    });

    await app.graphql.mutate(
      gql`
        mutation deleteProjectMember($id: ID!) {
          deleteProjectMember(id: $id)
        }
      `,
      {
        id: projectMember.id,
      }
    );

    const newProjectMember = await createProjectMember(app, {
      userId: member.id,
      projectId: project.id,
    });

    expect(newProjectMember.id).toBeTruthy();
  });

  it('update projectMember', async () => {
    await login(app, { email: user.email.value, password });
    const project = await createProject(app);
    const member = await createUser(app, { password });
    const projectMember = await createProjectMember(app, {
      userId: member.id,
      projectId: project.id,
    });

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
    const updated = result.updateProjectMember.projectMember;
    const difference = Interval.fromDateTimes(
      DateTime.fromISO(projectMember.modifiedAt.toString()),
      DateTime.fromISO(updated.modifiedAt)
    )
      .toDuration()
      .toFormat('S');
    expect(updated).toBeTruthy();
    expect(parseInt(difference)).toBeGreaterThan(0);
  });
});
