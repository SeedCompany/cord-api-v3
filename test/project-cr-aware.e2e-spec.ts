import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { CalendarDate } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { PartnerType } from '../src/components/partner';
import { CreatePartnership } from '../src/components/partnership';
import { PlanChangeStatus } from '../src/components/plan-change/dto/plan-change-status.enum';
import { Role } from '../src/components/project';
import { User } from '../src/components/user/dto/user.dto';
import {
  createFundingAccount,
  createLocation,
  createOrganization,
  createPartner,
  createPlanChange,
  createProject,
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
      // ProjectStep.Active,
    ]) {
      await changeProjectStep(app, project.id, next);
    }
  });

  return project;
};

describe('Project CR Aware e2e', () => {
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

  it('CR aware project name', async () => {
    const project = await activeProject(app);
    const planChange = await createPlanChange(app, {
      projectId: project.id,
    });
    expect(planChange.id).toBeTruthy();

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
          changeset: planChange.id,
        },
      }
    );
    expect(mutationResult.updateProject.project.name.value).toBe(newCRName);

    // Query project without changeset
    let result = await readProject(app, project.id);
    expect(result.project.name.value).toBe(project.name.value);

    // Query project with changeset
    result = await readProject(app, project.id, planChange.id);
    expect(result.project.name.value).toBe(newCRName);

    // Approve CR
    await app.graphql.mutate(
      gql`
        mutation updatePlanChange($input: UpdatePlanChangeInput!) {
          updatePlanChange(input: $input) {
            planChange {
              ...planChange
            }
          }
        }
        ${fragments.planChange}
      `,
      {
        input: {
          planChange: {
            id: planChange.id,
            status: PlanChangeStatus.Approved,
          },
        },
      }
    );

    // Project name is changed without changeset
    result = await readProject(app, project.id);
    expect(result.project.name.value).toBe(newCRName);
  });

  it('CR aware project mouStart and mouEnd', async () => {
    const project = await activeProject(app);
    const planChange = await createPlanChange(app, {
      projectId: project.id,
    });
    expect(planChange.id).toBeTruthy();

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
          changeset: planChange.id,
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
    result = await readProject(app, project.id, planChange.id);
    expect(result.project.mouStart.value).toBe(mouStart);
    expect(result.project.mouEnd.value).toBe(mouEnd);

    // Approve CR
    await app.graphql.mutate(
      gql`
        mutation updatePlanChange($input: UpdatePlanChangeInput!) {
          updatePlanChange(input: $input) {
            planChange {
              ...planChange
            }
          }
        }
        ${fragments.planChange}
      `,
      {
        input: {
          planChange: {
            id: planChange.id,
            status: PlanChangeStatus.Approved,
          },
        },
      }
    );

    // Project mouStart/mouEnd are changed
    result = await readProject(app, project.id);
    expect(result.project.mouStart.value).toBe(mouStart);
    expect(result.project.mouEnd.value).toBe(mouEnd);
  });

  it('CR aware budget records', async () => {
    const project = await activeProject(app);
    const planChange = await createPlanChange(app, {
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
          changeset: planChange.id,
        },
      }
    );

    // Query project without changeset
    let result = await readProject(app, project.id);
    expect(result.project.budget.value.records.length).toBe(0);

    // Query project with changeset
    result = await readProject(app, project.id, planChange.id);
    expect(result.project.budget.value.records.length).toBe(2);

    // Approve CR
    await app.graphql.mutate(
      gql`
        mutation updatePlanChange($input: UpdatePlanChangeInput!) {
          updatePlanChange(input: $input) {
            planChange {
              ...planChange
            }
          }
        }
        ${fragments.planChange}
      `,
      {
        input: {
          planChange: {
            id: planChange.id,
            status: PlanChangeStatus.Approved,
          },
        },
      }
    );
    // Query project without changeset
    result = await readProject(app, project.id);
    expect(result.project.budget.value.records.length).toBe(2);
  });
});
