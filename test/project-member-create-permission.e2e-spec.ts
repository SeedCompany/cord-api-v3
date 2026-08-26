import { beforeAll, describe, expect, it } from '@jest/globals';
import { generateId, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createPerson,
  createProject,
  createSession,
  createTestApp,
  errors,
  registerUser,
  runAsAdmin,
  type TestApp,
  type TestUser,
} from './utility';

/**
 * Does the team-membership requirement on adding project members hold?
 *
 * A project manager's grant reads
 * `r.ProjectMember.read.when(member).edit.create.delete` — reading any
 * membership is unconditional, but creating one is supposed to require the
 * requester to already be on that project's team.
 *
 * It holds for adding somebody else, and it does not hold for adding yourself.
 * A project manager can put themselves on the team of any project in the
 * system, and being a member is then what every other member-only right is
 * checked against, so they can go on to edit that project, add other people to
 * it, and so on.
 *
 * The reason is the order of two steps in `ProjectMemberService.create`: it
 * calls `repo.create(input)` first and `privileges.for(ProjectMember, created)
 * .verifyCan('create')` second, and the object it checks is the row that was
 * just written. Adding yourself makes you a member, so by the time the check
 * runs, the thing it is testing for is true. The create authorizes itself.
 * Adding somebody else does not, which is why one of these passes and the
 * other does not.
 *
 * Measured on both engines on 2026-08-26, four checks each, same result on
 * every one — so this is not something the Postgres port introduced. The
 * permission check sits in the service, above the `splitDb` boundary, where
 * there is only one implementation for both databases to share. By the standing
 * rule that pre-existing defects wait for the cutover, this is a post-cutover
 * fix; it is recorded in the pre-cutover audit ledger.
 *
 * Run it on both engines:
 *   yarn test:e2e --testPathPatterns project-member-create-permission
 *   DATABASE=postgres POSTGRES_URL=... yarn test:e2e --testPathPatterns project-member-create-permission
 *
 * Note the actor holds ONLY ProjectManager. Policies add together, and several
 * other roles (Field Operations Director, Field Services, Consultant Manager,
 * Financial Analyst Lead, Experience Operations) grant
 * `r.ProjectMember.edit.create.delete` with no membership condition at all — so
 * a project manager who also holds one of those is allowed to do all of this,
 * and correctly so. A permission result means nothing until you know every role
 * the person holds.
 */
describe('ProjectMember create permission', () => {
  let app: TestApp;
  let projectManager: TestUser;

  /** A project the project manager is not on: whoever creates one joins its team. */
  const someoneElsesProject = async () =>
    await runAsAdmin(app, async () => (await createProject(app)).id);

  const someoneToAdd = async () =>
    await runAsAdmin(app, async () => (await createPerson(app)).id);

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    projectManager = await registerUser(app, { roles: [Role.ProjectManager] });
  });

  it('can add someone to a project they manage', async () => {
    const newcomer = await someoneToAdd();
    const result = await projectManager.runAs(async () => {
      // Creating a project puts the creator on its team, so this is a project
      // they manage.
      const project = await createProject(app);
      return await app.graphql.mutate(CreateMember, {
        input: { project: project.id, user: newcomer },
      });
    });
    expect(result.createProjectMember.projectMember.id).toBeTruthy();
  });

  it('cannot add someone else to a project they do not manage', async () => {
    const project = await someoneElsesProject();
    const newcomer = await someoneToAdd();
    await expect(
      projectManager.runAs(
        async () =>
          await app.graphql.mutate(CreateMember, {
            input: { project, user: newcomer },
          }),
      ),
    ).rejects.toThrowGqlError(errors.unauthorized());
  });

  /**
   * `it.failing` states the rule the policy is written to express, and passes
   * for as long as the code does not honour it. Fix the create-then-check order
   * in `ProjectMemberService.create` and this turns red with "Failing test
   * passed" — at which point drop the `.failing` here and delete the test
   * below, whose whole subject is what the gap allows.
   */
  it.failing(
    'cannot add themselves to a project they do not manage',
    async () => {
      const project = await someoneElsesProject();
      await expect(
        projectManager.runAs(
          async () =>
            await app.graphql.mutate(CreateMember, {
              input: { project, user: projectManager.id },
            }),
        ),
      ).rejects.toThrowGqlError(errors.unauthorized());
    },
  );

  /** What the gap above is worth: everything gated on being a member. */
  it('self-added membership then grants the member-only rights', async () => {
    const project = await someoneElsesProject();
    const name = 'renamed by a non-member ' + (await generateId());
    const result = await projectManager.runAs(async () => {
      await app.graphql.mutate(CreateMember, {
        input: { project, user: projectManager.id },
      });
      return await app.graphql.mutate(UpdateProjectName, {
        input: { id: project, name },
      });
    });
    expect(result.updateProject.project.name.value).toBe(name);
  });
});

const CreateMember = graphql(`
  mutation CreateMemberForPermissionCheck($input: CreateProjectMember!) {
    createProjectMember(input: $input) {
      projectMember {
        id
      }
    }
  }
`);

const UpdateProjectName = graphql(`
  mutation UpdateProjectNameForPermissionCheck($input: UpdateProject!) {
    updateProject(input: $input) {
      project {
        id
        name {
          value
        }
      }
    }
  }
`);
