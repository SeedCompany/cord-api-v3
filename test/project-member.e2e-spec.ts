import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { times } from 'lodash';
import { DateTime, Interval } from 'luxon';
import { isValidId, NotFoundException } from '../src/common';
import { ProjectMember, Role } from '../src/components/project';
import { User } from '../src/components/user';
import {
  createPerson,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  fragments,
  login,
  registerUser,
  TestApp,
} from './utility';
import { resetDatabase } from './utility/reset-database';

describe('ProjectMember e2e', () => {
  let app: TestApp;
  let user: User;
  const password: string = faker.internet.password();
  let db: Connection;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    user = await registerUser(app, {
      password,
      roles: [
        Role.ProjectManager,
        Role.Consultant,
        Role.FieldOperationsDirector,
      ],
    });
  });
  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('create projectMember', async () => {
    await login(app, { email: user.email.value, password });
    const project = await createProject(app);
    const member = await registerUser(app, { password });
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

  it('should throw error with invalid user roles when create', async () => {
    await login(app, { email: user.email.value, password });
    const project = await createProject(app);
    const member = await registerUser(app, { password });
    await expect(
      createProjectMember(app, {
        userId: member.id,
        projectId: project.id,
        roles: [Role.Controller],
      })
    ).rejects.toThrowError(
      'Role(s) Controller cannot be assigned to this project member'
    );
  });

  it('read one projectMember by id', async () => {
    await login(app, { email: user.email.value, password });
    const project = await createProject(app);
    const member = await registerUser(app, { password });
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
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.user.value?.id).toBe(member.id);
  });

  it.skip('list view of ProjectMember', async () => {
    const numProjectMembers = 2;
    const userForList = await registerUser(app, { password });
    const userId = userForList.id;
    const projectIds: string[] = [];

    await Promise.all(
      times(numProjectMembers).map(async () => {
        await registerUser(app);
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

  it.skip('delete projectMember', async () => {
    await login(app, { email: user.email.value, password });
    const project = await createProject(app);
    const member = await registerUser(app, { password });
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
    ).rejects.toThrowError(
      new NotFoundException('Could not find project member')
    );
  });

  it('Can create the same projectMember after deletion', async () => {
    await login(app, { email: user.email.value, password });
    const project = await createProject(app);
    const member = await registerUser(app, { password });
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
    const member = await createPerson(app, {
      roles: [Role.ProjectManager, Role.Consultant],
    });
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
            roles: [Role.ProjectManager],
          },
        },
      }
    );
    expect(result.updateProjectMember.projectMember.id).toBe(projectMember.id);
    expect(result.updateProjectMember.projectMember.roles.value).toEqual(
      expect.arrayContaining([Role.ProjectManager])
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

  it('should throw error with invalid roles when update', async () => {
    await login(app, { email: user.email.value, password });
    const project = await createProject(app);
    const member = await registerUser(app, { password });
    const projectMember = await createProjectMember(app, {
      userId: member.id,
      projectId: project.id,
    });

    await expect(
      app.graphql.query(
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
      )
    ).rejects.toThrowError(
      'Role(s) Intern cannot be assigned to this project member'
    );
  });
});
