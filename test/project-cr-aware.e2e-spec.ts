import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { CalendarDate } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { PartnerType } from '../src/components/partner';
import { CreatePartnership } from '../src/components/partnership';
import { PlanChangeStatus } from '../src/components/plan-change/dto/plan-change-status.enum';
import { Project, Role } from '../src/components/project';
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
  Raw,
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

const readProject = (app: TestApp, id: string, changeId?: string) =>
  app.graphql.query(
    gql`
      query project($id: ID!, $changeId: ID) {
        project(id: $id, changeId: $changeId) {
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
      changeId,
    }
  );

describe('Project CR Aware e2e', () => {
  let app: TestApp;
  let director: User;
  let db: Connection;
  let project: Raw<Project>;
  const password = faker.internet.password();

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);

    director = await registerUserWithPower(app, [Powers.DeleteProject], {
      roles: [Role.ProjectManager],
      password: password,
    });

    // Change project status to Active
    const fundingAccount = await createFundingAccount(app);
    const location = await createLocation(app, {
      fundingAccountId: fundingAccount.id,
    });
    const fieldRegion = await createRegion(app);
    project = await createProject(app, {
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

    await login(app, { email: director.email.value, password });
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('CR aware project name', async () => {
    const planChange = await createPlanChange(app, {
      projectId: project.id,
    });
    expect(planChange.id).toBeTruthy();

    // Update project with changeId
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
          changeId: planChange.id,
        },
      }
    );
    expect(mutationResult.updateProject.project.name.value).toBe(newCRName);

    // Query project without changeId
    let result = await readProject(app, project.id);
    expect(result.project.name.value).toBe(project.name.value);

    // Query project with changeId
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

    // Project name is changed without changeId
    result = await readProject(app, project.id);
    expect(result.project.name.value).toBe(newCRName);
  });

  it('CR aware budget records', async () => {
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
          changeId: planChange.id,
        },
      }
    );

    // Query project without changeId
    let result = await readProject(app, project.id);
    expect(result.project.budget.value.records.length).toBe(0);

    // Query project with changeId
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
    // Query project without changeId
    result = await readProject(app, project.id);
    expect(result.project.budget.value.records.length).toBe(2);
  });
});
