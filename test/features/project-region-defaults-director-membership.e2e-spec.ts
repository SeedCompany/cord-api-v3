import { afterAll, beforeAll, expect, it } from '@jest/globals';
import { mapEntries } from '@seedcompany/common';
import { DateTime } from 'luxon';
import { Role } from '~/common';
import { graphql, type VariablesOf } from '~/graphql';
import {
  createProject,
  createProjectMember,
  createRegion,
  createSession,
  createTestApp,
  loginAsAdmin,
  type TestApp,
} from '../utility';

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
  await createSession(app);
  await loginAsAdmin(app);
});
afterAll(async () => {
  await app.close();
});

it('add directors if role is needed on project', async () => {
  const region = await createRegion(app);
  const project = await createProject(app);

  const members = await assignRegionAndFetchMembers(app, {
    project: project.id,
    region: region.id,
  });

  expect(members.get(region.director.value!.id)).toEqual(
    expect.objectContaining({
      active: true,
      roles: [Role.RegionalDirector],
    }),
  );
  expect(members.get(region.fieldZone.value!.director.value!.id)).toEqual(
    expect.objectContaining({
      active: true,
      roles: [Role.FieldOperationsDirector],
    }),
  );
});

it('add directors if role is inactive on project', async () => {
  // region setup
  const newRegion = await createRegion(app);
  const oldRegion = await createRegion(app);
  const project = await createProject(app);
  await Promise.all([
    createProjectMember(app, {
      project: project.id,
      user: oldRegion.director.value!.id,
      roles: [Role.RegionalDirector],
      inactiveAt: DateTime.now().plus({ minute: 1 }).toISO(),
    }),
    createProjectMember(app, {
      project: project.id,
      user: oldRegion.fieldZone.value!.director.value!.id,
      roles: [Role.FieldOperationsDirector],
      inactiveAt: DateTime.now().plus({ minute: 1 }).toISO(),
    }),
  ]);
  // endregion

  const members = await assignRegionAndFetchMembers(app, {
    project: project.id,
    region: newRegion.id,
  });

  expect(members.get(oldRegion.director.value!.id)).toEqual(
    expect.objectContaining({
      active: false,
      roles: [Role.RegionalDirector],
    }),
  );
  expect(members.get(newRegion.director.value!.id)).toEqual(
    expect.objectContaining({
      active: true,
      roles: [Role.RegionalDirector],
    }),
  );
  expect(members.get(oldRegion.fieldZone.value!.director.value!.id)).toEqual(
    expect.objectContaining({
      active: false,
      roles: [Role.FieldOperationsDirector],
    }),
  );
  expect(members.get(newRegion.fieldZone.value!.director.value!.id)).toEqual(
    expect.objectContaining({
      active: true,
      roles: [Role.FieldOperationsDirector],
    }),
  );
});

it('update existing member on project', async () => {
  // region setup
  const region = await createRegion(app);
  const project = await createProject(app);
  await createProjectMember(app, {
    project: project.id,
    user: region.director.value!.id,
    roles: [Role.ProjectManager],
  });
  // endregion

  const members = await assignRegionAndFetchMembers(app, {
    project: project.id,
    region: region.id,
  });

  expect(members.get(region.director.value!.id)).toEqual(
    expect.objectContaining({
      active: true,
      roles: expect.arrayContaining([
        Role.RegionalDirector,
        Role.ProjectManager,
      ]),
    }),
  );
});

it('ignore directors if role is not needed on project', async () => {
  // region setup
  const region = await createRegion(app);
  const unrelatedRegion = await createRegion(app);
  const project = await createProject(app);
  await Promise.all([
    createProjectMember(app, {
      project: project.id,
      user: unrelatedRegion.director.value!.id,
      roles: [Role.RegionalDirector],
    }),
    createProjectMember(app, {
      project: project.id,
      user: unrelatedRegion.fieldZone.value!.director.value!.id,
      roles: [Role.FieldOperationsDirector],
    }),
  ]);
  // endregion

  const members = await assignRegionAndFetchMembers(app, {
    project: project.id,
    region: region.id,
  });

  expect(members.get(region.director.value!.id)).toBeUndefined();
  expect(
    members.get(region.fieldZone.value!.director.value!.id),
  ).toBeUndefined();
});

async function assignRegionAndFetchMembers(
  app: TestApp,
  input: VariablesOf<typeof AssignRegionDoc>,
) {
  const res = await app.graphql.query(AssignRegionDoc, input);
  const members = res.updateProject.project.team.items.map((m) => ({
    user: m.user.value!.id,
    active: m.active,
    roles: m.roles.value,
  }));
  if (members.length !== new Set(members.map((m) => m.user)).size) {
    throw new Error('Duplicate members detected');
  }
  return mapEntries(members, (m) => [m.user, m]).asMap;
}

const AssignRegionDoc = graphql(`
  mutation AssignRegion($project: ID!, $region: ID!) {
    updateProject(input: { project: { id: $project, fieldRegion: $region } }) {
      project {
        team {
          items {
            user {
              value {
                id
              }
            }
            roles {
              value
            }
            active
          }
        }
      }
    }
  }
`);
