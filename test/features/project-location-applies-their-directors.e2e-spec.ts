import { Role } from '~/common';
import { graphql, type VariablesOf } from '~/graphql';
import {
  createPerson,
  createProject,
  createRegion,
  createSession,
  createTestApp,
  createZone,
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
  // region setup
  const zoneDirector = await createPerson(app, {
    roles: [Role.FieldOperationsDirector],
  });
  const zone = await createZone(app, {
    directorId: zoneDirector.id,
  });

  const regionalDirector = await createPerson(app, {
    roles: [Role.RegionalDirector],
  });
  const region = await createRegion(app, {
    directorId: regionalDirector.id,
    fieldZoneId: zone.id,
  });

  const project = await createProject(app);

  // await createProjectMember(app, {
  //   projectId: project.id,
  //   userId: directors.old.id,
  //   roles: [Role.RegionalDirector],
  // });
  // endregion

  const members = await assignRegionAndFetchMembers(app, {
    project: project.id,
    region: region.id,
  });

  const rd = members.find((m) => m.user.value!.id === regionalDirector.id);
  expect(rd).toBeTruthy();
  expect(rd!.roles.value).toContain(Role.RegionalDirector);
  expect(rd!.active).toBe(true);

  const fod = members.find((m) => m.user.value!.id === zoneDirector.id);
  expect(fod).toBeTruthy();
  expect(fod!.roles.value).toContain(Role.FieldOperationsDirector);
  expect(fod!.active).toBe(true);
});

it.todo('add directors if role is inactive on project');

it.todo('ignore directors if role is not needed on project');

async function assignRegionAndFetchMembers(
  app: TestApp,
  input: VariablesOf<typeof AssignRegionDoc>,
) {
  const res = await app.graphql.query(AssignRegionDoc, input);
  const members = res.updateProject.project.team.items;
  if (members.length !== new Set(members.map((m) => m.user.value!.id)).size) {
    throw new Error('Duplicate members detected');
  }
  return members;
}

const AssignRegionDoc = graphql(`
  mutation AssignRegion($project: ID!, $region: ID!) {
    updateProject(
      input: { project: { id: $project, fieldRegionId: $region } }
    ) {
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
