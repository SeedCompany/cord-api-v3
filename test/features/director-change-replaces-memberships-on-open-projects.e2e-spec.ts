import { DateTime } from 'luxon';
import { type ID, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createLocation,
  createPerson,
  createProject,
  createProjectMember,
  createRegion,
  createSession,
  createTestApp,
  loginAsAdmin,
  type TestApp,
} from '../utility';
import { transitionProject } from '../utility/transition-project';

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
  await createSession(app);
  await loginAsAdmin(app);
});
afterAll(async () => {
  await app.close();
});

it('director change replaces memberships on open projects', async () => {
  // region setup
  const directors = {
    old: await createPerson(app, { roles: ['RegionalDirector'] }),
    new: await createPerson(app, { roles: ['RegionalDirector'] }),
    unrelated: await createPerson(app, { roles: ['RegionalDirector'] }),
  };
  const region = await createRegion(app, {
    name: 'Region',
    directorId: directors.old.id,
  });
  const projects = {
    needsSwapA: await (async () => {
      const project = await createProject(app);
      await createProjectMember(app, {
        projectId: project.id,
        userId: directors.old.id,
        roles: [Role.RegionalDirector],
      });
      return project;
    })(),
    needsSwapB: await (async () => {
      const project = await createProject(app);
      await createProjectMember(app, {
        projectId: project.id,
        userId: directors.old.id,
        roles: [Role.RegionalDirector],
      });
      return project;
    })(),
    doesNotHaveMember: await createProject(app),
    hasMemberButInactive: await (async () => {
      const project = await createProject(app);
      await createProjectMember(app, {
        projectId: project.id,
        userId: directors.old.id,
        roles: [Role.RegionalDirector],
        inactiveAt: DateTime.now().plus({ minute: 1 }).toISO(),
      });
      return project;
    })(),
    alreadyHasRoleFilled: await (async () => {
      const project = await createProject(app);
      await createProjectMember(app, {
        projectId: project.id,
        userId: directors.unrelated.id,
        roles: [Role.RegionalDirector],
      });
      return project;
    })(),
    alreadyHasNewDirectorActive: await (async () => {
      const project = await createProject(app);
      await createProjectMember(app, {
        projectId: project.id,
        userId: directors.old.id,
        roles: [Role.RegionalDirector],
      });
      await createProjectMember(app, {
        projectId: project.id,
        userId: directors.new.id,
        roles: [Role.RegionalDirector],
      });
      return project;
    })(),
    alreadyHasNewDirectorInactive: await (async () => {
      const project = await createProject(app);
      await createProjectMember(app, {
        projectId: project.id,
        userId: directors.old.id,
        roles: [Role.RegionalDirector],
      });
      await createProjectMember(app, {
        projectId: project.id,
        userId: directors.new.id,
        roles: [Role.RegionalDirector],
        inactiveAt: DateTime.now().plus({ minute: 1 }).toISO(),
      });
      return project;
    })(),
    alreadyHasNewDirectorWithoutRole: await (async () => {
      const project = await createProject(app);
      await createProjectMember(app, {
        projectId: project.id,
        userId: directors.old.id,
        roles: [Role.RegionalDirector],
      });
      await createProjectMember(app, {
        projectId: project.id,
        userId: directors.new.id,
        roles: [Role.ProjectManager],
      });
      return project;
    })(),
    closed: await (async () => {
      const project = await createProject(app, {
        mouStart: '2025-06-05',
        mouEnd: '2025-06-05',
        primaryLocationId: await createLocation(app).then(({ id }) => id),
      });
      await createProjectMember(app, {
        projectId: project.id,
        userId: directors.old.id,
        roles: [Role.RegionalDirector],
      });
      await transitionProject(app, {
        project: project.id,
        bypassTo: 'Completed',
      });
      return project;
    })(),
  };

  const getResults = async () => {
    const results = {
      needsSwapA: await fetchMembers(app, projects.needsSwapA.id),
      needsSwapB: await fetchMembers(app, projects.needsSwapB.id),
      doesNotHaveMember: await fetchMembers(app, projects.doesNotHaveMember.id),
      hasMemberButInactive: await fetchMembers(
        app,
        projects.hasMemberButInactive.id,
      ),
      alreadyHasRoleFilled: await fetchMembers(
        app,
        projects.alreadyHasRoleFilled.id,
      ),
      alreadyHasNewDirectorActive: await fetchMembers(
        app,
        projects.alreadyHasNewDirectorActive.id,
      ),
      alreadyHasNewDirectorInactive: await fetchMembers(
        app,
        projects.alreadyHasNewDirectorInactive.id,
      ),
      alreadyHasNewDirectorWithoutRole: await fetchMembers(
        app,
        projects.alreadyHasNewDirectorWithoutRole.id,
      ),
      closed: await fetchMembers(app, projects.closed.id),
    };

    return {
      get: (project: keyof typeof results, key: keyof typeof directors) => {
        const member = results[project].find(
          (member) => member.user.value!.id === directors[key].id,
        );
        return member
          ? {
              active: member.active,
              roles: member.roles.value,
            }
          : undefined;
      },
    };
  };
  // endregion

  // region validate setup
  const before = await getResults();

  const ActiveRD = { active: true, roles: ['RegionalDirector'] };
  const InactiveRD = { active: false, roles: ['RegionalDirector'] };

  expect(before.get('needsSwapA', 'old')).toEqual(ActiveRD);
  expect(before.get('needsSwapA', 'new')).toBeUndefined();
  expect(before.get('needsSwapB', 'old')).toEqual(ActiveRD);
  expect(before.get('needsSwapB', 'new')).toBeUndefined();

  expect(before.get('needsSwapA', 'unrelated')).toBeUndefined();
  expect(before.get('needsSwapB', 'unrelated')).toBeUndefined();
  expect(before.get('doesNotHaveMember', 'old')).toBeUndefined();
  expect(before.get('doesNotHaveMember', 'new')).toBeUndefined();
  expect(before.get('doesNotHaveMember', 'unrelated')).toBeUndefined();
  expect(before.get('hasMemberButInactive', 'old')).toEqual(InactiveRD);
  expect(before.get('hasMemberButInactive', 'new')).toBeUndefined();
  expect(before.get('hasMemberButInactive', 'unrelated')).toBeUndefined();
  expect(before.get('alreadyHasRoleFilled', 'old')).toBeUndefined();
  expect(before.get('alreadyHasRoleFilled', 'new')).toBeUndefined();
  expect(before.get('alreadyHasRoleFilled', 'unrelated')).toEqual(ActiveRD);
  expect(before.get('alreadyHasNewDirectorActive', 'old')).toEqual(ActiveRD);
  expect(before.get('alreadyHasNewDirectorActive', 'new')).toEqual(ActiveRD);
  expect(
    before.get('alreadyHasNewDirectorActive', 'unrelated'),
  ).toBeUndefined();
  expect(before.get('alreadyHasNewDirectorInactive', 'old')).toEqual(ActiveRD);
  expect(before.get('alreadyHasNewDirectorInactive', 'new')).toEqual(
    InactiveRD,
  );
  expect(
    before.get('alreadyHasNewDirectorInactive', 'unrelated'),
  ).toBeUndefined();
  expect(before.get('alreadyHasNewDirectorWithoutRole', 'old')).toEqual(
    ActiveRD,
  );
  expect(before.get('alreadyHasNewDirectorWithoutRole', 'new')).toEqual({
    active: true,
    roles: [Role.ProjectManager],
  });
  expect(
    before.get('alreadyHasNewDirectorWithoutRole', 'unrelated'),
  ).toBeUndefined();
  expect(before.get('closed', 'old')).toEqual(ActiveRD);
  expect(before.get('closed', 'new')).toBeUndefined();
  expect(before.get('closed', 'unrelated')).toBeUndefined();
  // endregion

  // region change director
  await app.graphql.mutate(
    graphql(`
      mutation ChangeDirector($region: ID!, $director: ID!) {
        updateFieldRegion(
          input: { fieldRegion: { id: $region, directorId: $director } }
        ) {
          __typename
        }
      }
    `),
    {
      region: region.id,
      director: directors.new.id,
    },
  );
  // endregion

  // region assertions
  const after = await getResults();

  expect(after.get('needsSwapA', 'old')).toEqual(InactiveRD);
  expect(after.get('needsSwapA', 'new')).toEqual(ActiveRD);
  expect(after.get('needsSwapB', 'old')).toEqual(InactiveRD);
  expect(after.get('needsSwapB', 'new')).toEqual(ActiveRD);

  expect(after.get('needsSwapA', 'unrelated')).toBeUndefined();
  expect(after.get('needsSwapB', 'unrelated')).toBeUndefined();
  expect(after.get('doesNotHaveMember', 'old')).toBeUndefined();
  expect(after.get('doesNotHaveMember', 'new')).toBeUndefined();
  expect(after.get('doesNotHaveMember', 'unrelated')).toBeUndefined();
  expect(after.get('hasMemberButInactive', 'old')).toEqual(InactiveRD);
  expect(after.get('hasMemberButInactive', 'new')).toBeUndefined();
  expect(after.get('hasMemberButInactive', 'unrelated')).toBeUndefined();
  expect(after.get('alreadyHasRoleFilled', 'old')).toBeUndefined();
  expect(after.get('alreadyHasRoleFilled', 'new')).toBeUndefined();
  expect(after.get('alreadyHasRoleFilled', 'unrelated')).toEqual(ActiveRD);
  expect(after.get('alreadyHasNewDirectorActive', 'old')).toEqual(InactiveRD);
  expect(after.get('alreadyHasNewDirectorActive', 'new')).toEqual(ActiveRD);
  expect(after.get('alreadyHasNewDirectorActive', 'unrelated')).toBeUndefined();
  expect(after.get('alreadyHasNewDirectorInactive', 'old')).toEqual(InactiveRD);
  expect(after.get('alreadyHasNewDirectorInactive', 'new')).toEqual(ActiveRD);
  expect(
    after.get('alreadyHasNewDirectorInactive', 'unrelated'),
  ).toBeUndefined();
  expect(after.get('alreadyHasNewDirectorWithoutRole', 'old')).toEqual(
    InactiveRD,
  );
  expect(after.get('alreadyHasNewDirectorWithoutRole', 'new')).toEqual({
    active: true,
    roles: [Role.ProjectManager, Role.RegionalDirector],
  });
  expect(
    after.get('alreadyHasNewDirectorWithoutRole', 'unrelated'),
  ).toBeUndefined();
  expect(after.get('closed', 'old')).toEqual(ActiveRD);
  expect(after.get('closed', 'new')).toBeUndefined();
  expect(after.get('closed', 'unrelated')).toBeUndefined();
  // endregion
});

async function fetchMembers(app: TestApp, projectId: ID) {
  const res = await app.graphql.query(
    graphql(
      `
        query ProjectMembers($projectId: ID!) {
          project(id: $projectId) {
            id
            team {
              items {
                user {
                  value {
                    id
                  }
                }
                active
                inactiveAt {
                  value
                }
                roles {
                  value
                }
              }
            }
          }
        }
      `,
    ),
    { projectId },
  );
  const members = res.project.team.items;
  if (members.length !== new Set(members.map((m) => m.user.value!.id)).size) {
    throw new Error('Duplicate members detected');
  }
  return members;
}
