import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { CalendarDate } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { PartnerType } from '../src/components/partner';
import { CreatePartnership } from '../src/components/partnership';
import { ProjectStep, Role } from '../src/components/project';
import { User } from '../src/components/user/dto/user.dto';
import {
  approveProjectChangeRequest,
  createFundingAccount,
  createLocation,
  createOrganization,
  createPartner,
  createProject,
  createProjectChangeRequest,
  createRegion,
  createSession,
  createTestApp,
  login,
  registerUserWithPower,
  runAsAdmin,
  TestApp,
  updateProject,
} from './utility';
import { fragments } from './utility/fragments';
import { resetDatabase } from './utility/reset-database';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
} from './utility/transition-project';

const readProject = (app: TestApp, id: string, changeset?: string) =>
  app.graphql.query(
    gql`
      query project($id: ID!, $changeset: ID) {
        project(id: $id, changeset: $changeset) {
          ...project
          budget {
            value {
              id
              records {
                id
              }
            }
          }
        }
      }
      ${fragments.project}
    `,
    {
      id,
      changeset,
    }
  );

const activeProject = async (app: TestApp) => {
  const fundingAccount = await createFundingAccount(app);
  const location = await createLocation(app, {
    fundingAccountId: fundingAccount.id,
  });
  const fieldRegion = await createRegion(app);
  const project = await createProject(app, {
    mouStart: undefined,
    mouEnd: undefined,
  });
  await updateProject(app, {
    id: project.id,
    primaryLocationId: location.id,
    fieldRegionId: fieldRegion.id,
  });
  await runAsAdmin(app, async () => {
    for (const next of [
      ...stepsFromEarlyConversationToBeforeActive,
      ProjectStep.Active,
    ]) {
      await changeProjectStep(app, project.id, next);
    }
  });

  return project;
};

describe('Project Changeset Aware e2e', () => {
  let app: TestApp;
  let director: User;
  let db: Connection;
  const password = faker.internet.password();

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);

    director = await registerUserWithPower(app, [Powers.DeleteProject], {
      roles: [Role.ProjectManager],
      password: password,
    });

    await login(app, { email: director.email.value, password });
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('name', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });

    // Update project with changeset
    const newCRName = faker.random.word() + ' ' + faker.datatype.uuid();
    const mutationResult = await app.graphql.mutate(
      gql`
        mutation updateProject($input: UpdateProjectInput!) {
          updateProject(input: $input) {
            project {
              ...project
            }
          }
        }
        ${fragments.project}
      `,
      {
        input: {
          project: {
            id: project.id,
            name: newCRName,
          },
          changeset: changeset.id,
        },
      }
    );
    expect(mutationResult.updateProject.project.name.value).toBe(newCRName);

    // Query project without changeset
    let result = await readProject(app, project.id);
    expect(result.project.name.value).toBe(project.name.value);

    // Query project with changeset
    result = await readProject(app, project.id, changeset.id);
    expect(result.project.name.value).toBe(newCRName);

    await approveProjectChangeRequest(app, changeset.id);

    // Project name is changed without changeset
    result = await readProject(app, project.id);
    expect(result.project.name.value).toBe(newCRName);
  });

  it('mouStart and mouEnd', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });

    // Update project with changeset
    const mouStart = '2020-08-23';
    const mouEnd = '2021-08-22';
    const mutationResult = await app.graphql.mutate(
      gql`
        mutation updateProject($input: UpdateProjectInput!) {
          updateProject(input: $input) {
            project {
              ...project
            }
          }
        }
        ${fragments.project}
      `,
      {
        input: {
          project: {
            id: project.id,
            mouStart: CalendarDate.fromISO(mouStart),
            mouEnd: CalendarDate.fromISO(mouEnd),
          },
          changeset: changeset.id,
        },
      }
    );
    expect(mutationResult.updateProject.project.mouStart.value).toBe(mouStart);
    expect(mutationResult.updateProject.project.mouEnd.value).toBe(mouEnd);

    // Query project without changeset
    let result = await readProject(app, project.id);
    expect(result.project.mouStart.value).toBeNull();
    expect(result.project.mouEnd.value).toBeNull();

    // Query project with changeset
    result = await readProject(app, project.id, changeset.id);
    expect(result.project.mouStart.value).toBe(mouStart);
    expect(result.project.mouEnd.value).toBe(mouEnd);

    await approveProjectChangeRequest(app, changeset.id);

    // Project mouStart/mouEnd are changed
    result = await readProject(app, project.id);
    expect(result.project.mouStart.value).toBe(mouStart);
    expect(result.project.mouEnd.value).toBe(mouEnd);
  });

  it('budget records', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });

    await registerUserWithPower(app, [Powers.CreateOrganization]);
    const org = await createOrganization(app);
    const partnership: CreatePartnership = {
      projectId: project.id,
      partnerId: (await createPartner(app, { organizationId: org.id })).id,
      types: [PartnerType.Funding],
    };

    // Create Partnership with Funding type
    await app.graphql.mutate(
      gql`
        mutation createPartnership($input: CreatePartnershipInput!) {
          createPartnership(input: $input) {
            partnership {
              ...partnership
            }
          }
        }
        ${fragments.partnership}
      `,
      {
        input: {
          partnership,
        },
      }
    );

    // Update Project with mou dates
    await app.graphql.mutate(
      gql`
        mutation updateProject($input: UpdateProjectInput!) {
          updateProject(input: $input) {
            project {
              ...project
              budget {
                value {
                  id
                  records {
                    id
                  }
                }
              }
            }
          }
        }
        ${fragments.project}
      `,
      {
        input: {
          project: {
            id: project.id,
            mouStart: CalendarDate.fromISO('2020-08-23'),
            mouEnd: CalendarDate.fromISO('2021-08-22'),
          },
          changeset: changeset.id,
        },
      }
    );

    // Query project without changeset
    let result = await readProject(app, project.id);
    expect(result.project.budget.value.records.length).toBe(0);

    // Query project with changeset
    result = await readProject(app, project.id, changeset.id);
    expect(result.project.budget.value.records.length).toBe(2);

    await approveProjectChangeRequest(app, changeset.id);

    // Query project without changeset
    result = await readProject(app, project.id);
    expect(result.project.budget.value.records.length).toBe(2);
  });
});
