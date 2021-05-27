import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { Powers } from '../src/components/authorization/dto/powers';
import { Project, ProjectStep, Role } from '../src/components/project';
import { PlanChangeStatus } from '../src/components/project/change-to-plan/dto/plan-change-status.enum';
import { User } from '../src/components/user/dto/user.dto';
import {
  createFundingAccount,
  createLocation,
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
    project = await createProject(app);
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
        mutation updateProject($input: UpdateProjectInput!, $changeId: ID) {
          updateProject(input: $input, changeId: $changeId) {
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
        },
        changeId: planChange.id,
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
});
