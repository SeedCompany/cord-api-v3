import { beforeAll, describe, expect, it } from '@jest/globals';
import { DateTime, Interval } from 'luxon';
import { Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createPerson,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  errors,
  fragments,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';

describe('ProjectMember e2e', () => {
  let app: TestApp;
  let project: fragments.project;

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

  it('create projectMember', async () => {
    const member = await createPerson(app);
    const projectMember = await createProjectMember(app, {
      user: member.id,
      project: project.id,
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
        user: member.id,
        project: project.id,
        roles: [Role.Controller],
      }),
    ).rejects.toThrowGqlError(
      errors.input({
        message: 'Role(s) Controller cannot be assigned to this project member',
        field: 'roles',
      }),
    );
  });

  it('delete projectMember', async () => {
    const member = await createPerson(app);
    const projectMember = await createProjectMember(app, {
      user: member.id,
      project: project.id,
    });

    const result = await app.graphql.mutate(
      graphql(`
        mutation deleteProjectMember($id: ID!) {
          deleteProjectMember(id: $id) {
            __typename
          }
        }
      `),
      {
        id: projectMember.id,
      },
    );

    const actual = result.deleteProjectMember;
    expect(actual).toBeTruthy();

    // Read the team back rather than the member directly. This test used to
    // query a root `projectMember(id:)` field and expect a NotFound; that field
    // no longer exists, so the assertion had stopped describing the schema and
    // failed on validation instead of on the behaviour it was checking. The
    // team list is how a member is reachable now, and "gone" is better stated
    // as absence from it than as an error from a lookup by id.
    const after = await app.graphql.query(
      graphql(
        `
          query project($id: ID!) {
            project(id: $id) {
              team {
                items {
                  ...projectMember
                }
                total
              }
            }
          }
        `,
        [fragments.projectMember],
      ),
      { id: project.id },
    );

    const ids = after.project.team.items.map((item) => item.id);
    expect(ids).not.toContain(projectMember.id);
  });

  it('Can create the same projectMember after deletion', async () => {
    const member = await createPerson(app);
    const projectMember = await createProjectMember(app, {
      user: member.id,
      project: project.id,
    });

    await app.graphql.mutate(
      graphql(`
        mutation deleteProjectMember($id: ID!) {
          deleteProjectMember(id: $id) {
            __typename
          }
        }
      `),
      {
        id: projectMember.id,
      },
    );

    const newProjectMember = await createProjectMember(app, {
      user: member.id,
      project: project.id,
    });

    expect(newProjectMember.id).toBeTruthy();
  });

  it('update projectMember', async () => {
    const { projectMember, result } = await runAsAdmin(app, async () => {
      const member = await createPerson(app, {
        roles: [Role.ProjectManager, Role.Consultant],
      });

      const projectMember = await createProjectMember(app, {
        user: member.id,
        project: project.id,
      });

      const result = await app.graphql.query(
        graphql(
          `
            mutation updateProjectMember($input: UpdateProjectMember!) {
              updateProjectMember(input: $input) {
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
            id: projectMember.id,
            roles: [Role.ProjectManager],
          },
        },
      );
      return { projectMember, result };
    });
    expect(result.updateProjectMember.projectMember.id).toBe(projectMember.id);
    expect(result.updateProjectMember.projectMember.roles.value).toEqual(
      expect.arrayContaining([Role.ProjectManager]),
    );
    const updated = result.updateProjectMember.projectMember;
    expect(updated).toBeTruthy();
    expect(+DateTime.fromISO(updated.modifiedAt)).toBeGreaterThan(
      +DateTime.fromISO(projectMember.modifiedAt),
    );
  });

  it('should throw error with invalid roles when update', async () => {
    const member = await createPerson(app);
    const projectMember = await createProjectMember(app, {
      user: member.id,
      project: project.id,
    });

    await expect(
      app.graphql.query(
        graphql(
          `
            mutation updateProjectMember($input: UpdateProjectMember!) {
              updateProjectMember(input: $input) {
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
            id: projectMember.id,
            roles: [Role.Intern],
          },
        },
      ),
    ).rejects.toThrowGqlError(
      errors.input({
        message: 'Role(s) Intern cannot be assigned to this project member',
        field: 'roles',
      }),
    );
  });
});
