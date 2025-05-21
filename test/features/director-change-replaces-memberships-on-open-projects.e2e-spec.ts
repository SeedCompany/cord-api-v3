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
      closed: await fetchMembers(app, projects.closed.id),
    };
    return {
      get: (project: keyof typeof results, key: keyof typeof directors) =>
        results[project].find(
          (member) => member.user.value!.id === directors[key].id,
        )?.active,
    };
  };
  // endregion

  // region validate setup
  const before = await getResults();

  expect(before.get('needsSwapA', 'old')).toBe(true);
  expect(before.get('needsSwapA', 'new')).toBeUndefined();
  expect(before.get('needsSwapB', 'old')).toBe(true);
  expect(before.get('needsSwapB', 'new')).toBeUndefined();

  expect(before.get('needsSwapA', 'unrelated')).toBeUndefined();
  expect(before.get('needsSwapB', 'unrelated')).toBeUndefined();
  expect(before.get('doesNotHaveMember', 'old')).toBeUndefined();
  expect(before.get('doesNotHaveMember', 'new')).toBeUndefined();
  expect(before.get('doesNotHaveMember', 'unrelated')).toBeUndefined();
  expect(before.get('hasMemberButInactive', 'old')).toBe(false);
  expect(before.get('hasMemberButInactive', 'new')).toBeUndefined();
  expect(before.get('hasMemberButInactive', 'unrelated')).toBeUndefined();
  expect(before.get('alreadyHasRoleFilled', 'old')).toBeUndefined();
  expect(before.get('alreadyHasRoleFilled', 'new')).toBeUndefined();
  expect(before.get('alreadyHasRoleFilled', 'unrelated')).toBe(true);
  expect(before.get('closed', 'old')).toBe(true);
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

  expect(after.get('needsSwapA', 'old')).toBe(false);
  expect(after.get('needsSwapA', 'new')).toBe(true);
  expect(after.get('needsSwapB', 'old')).toBe(false);
  expect(after.get('needsSwapB', 'new')).toBe(true);

  expect(after.get('needsSwapA', 'unrelated')).toBeUndefined();
  expect(after.get('needsSwapB', 'unrelated')).toBeUndefined();
  expect(after.get('doesNotHaveMember', 'old')).toBeUndefined();
  expect(after.get('doesNotHaveMember', 'new')).toBeUndefined();
  expect(after.get('doesNotHaveMember', 'unrelated')).toBeUndefined();
  expect(after.get('hasMemberButInactive', 'old')).toBe(false);
  expect(after.get('hasMemberButInactive', 'new')).toBeUndefined();
  expect(after.get('hasMemberButInactive', 'unrelated')).toBeUndefined();
  expect(after.get('alreadyHasRoleFilled', 'old')).toBeUndefined();
  expect(after.get('alreadyHasRoleFilled', 'new')).toBeUndefined();
  expect(after.get('alreadyHasRoleFilled', 'unrelated')).toBe(true);
  expect(after.get('closed', 'old')).toBe(true);
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
              }
            }
          }
        }
      `,
    ),
    { projectId },
  );
  return res.project.team.items;
}
