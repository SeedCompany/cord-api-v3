import { DateTime, Interval } from 'luxon';
import { Role } from '~/common';
import { Project } from '../src/components/project/dto';
import { ProjectMember } from '../src/components/project/project-member/dto';
import {
  createPerson,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  errors,
  fragments,
  gql,
  Raw,
  registerUser,
  runAsAdmin,
  TestApp,
} from './utility';

describe('ProjectMember e2e', () => {
  let app: TestApp;
  let project: Raw<Project>;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [
        Role.ProjectManager,
        Role.Consultant,
        Role.FieldOperationsDirector,
      ],
    });
    project = await createProject(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('create projectMember', async () => {
    const member = await createPerson(app);
    const projectMember = await createProjectMember(app, {
      userId: member.id,
      projectId: project.id,
    });
    expect(projectMember.id).toBeDefined();
    expect(projectMember.modifiedAt).toBeDefined();
    const difference = Interval.fromDateTimes(
      DateTime.fromISO(projectMember.modifiedAt.toString()),
      DateTime.local(),
    )
      .toDuration()
      .toFormat('S');
    expect(parseInt(difference)).toBeGreaterThan(0);
  });

  it('should throw error with invalid user roles when create', async () => {
    const member = await createPerson(app);
    await expect(
      createProjectMember(app, {
        userId: member.id,
        projectId: project.id,
        roles: [Role.Controller],
      }),
    ).rejects.toThrowGqlError(
      errors.input({
        message: 'Role(s) Controller cannot be assigned to this project member',
        field: 'input.roles',
      }),
    );
  });

  it.skip('delete projectMember', async () => {
    const member = await createPerson(app);
    const projectMember = await createProjectMember(app, {
      userId: member.id,
      projectId: project.id,
    });

    const result = await app.graphql.mutate(
      gql`
        mutation deleteProjectMember($id: ID!) {
          deleteProjectMember(id: $id) {
            __typename
          }
        }
      `,
      {
        id: projectMember.id,
      },
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
        },
      ),
    ).rejects.toThrowGqlError(
      errors.notFound({
        message: 'Could not find project member',
        field: 'projectMember.id',
      }),
    );
  });

  it('Can create the same projectMember after deletion', async () => {
    const member = await createPerson(app);
    const projectMember = await createProjectMember(app, {
      userId: member.id,
      projectId: project.id,
    });

    await app.graphql.mutate(
      gql`
        mutation deleteProjectMember($id: ID!) {
          deleteProjectMember(id: $id) {
            __typename
          }
        }
      `,
      {
        id: projectMember.id,
      },
    );

    const newProjectMember = await createProjectMember(app, {
      userId: member.id,
      projectId: project.id,
    });

    expect(newProjectMember.id).toBeTruthy();
  });

  it('update projectMember', async () => {
    const { projectMember, result } = await runAsAdmin(app, async () => {
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
        },
      );
      return { projectMember, result };
    });
    expect(result.updateProjectMember.projectMember.id).toBe(projectMember.id);
    expect(result.updateProjectMember.projectMember.roles.value).toEqual(
      expect.arrayContaining([Role.ProjectManager]),
    );
    const updated: Raw<ProjectMember> =
      result.updateProjectMember.projectMember;
    expect(updated).toBeTruthy();
    expect(+DateTime.fromISO(updated.modifiedAt)).toBeGreaterThan(
      +DateTime.fromISO(projectMember.modifiedAt),
    );
  });

  it('should throw error with invalid roles when update', async () => {
    const member = await createPerson(app);
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
        },
      ),
    ).rejects.toThrowGqlError(
      errors.input({
        message: 'Role(s) Intern cannot be assigned to this project member',
        field: 'input.roles',
      }),
    );
  });
});
