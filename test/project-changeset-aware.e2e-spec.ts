import { faker } from '@faker-js/faker';
import { CalendarDate, Role } from '~/common';
import { PartnerType } from '../src/components/partner/dto';
import { ProjectStep } from '../src/components/project/dto';
import {
  approveProjectChangeRequest,
  createFundingAccount,
  createLocation,
  createPartnership,
  createProject,
  createProjectChangeRequest,
  createRegion,
  createSession,
  createTestApp,
  gql,
  registerUser,
  runAsAdmin,
  TestApp,
} from './utility';
import { fragments } from './utility/fragments';
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
    },
  );

const activeProject = async (app: TestApp) => {
  const [location, fieldRegion] = await runAsAdmin(app, async () => {
    const fundingAccount = await createFundingAccount(app);
    const location = await createLocation(app, {
      fundingAccountId: fundingAccount.id,
    });
    const fieldRegion = await createRegion(app);

    return [location, fieldRegion];
  });
  const project = await createProject(app, {
    mouStart: undefined,
    mouEnd: undefined,
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

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);

    await registerUser(app, {
      roles: [Role.Administrator],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('name', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });

    // Update project with changeset
    const newCRName = faker.lorem.word() + ' ' + faker.string.uuid();
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
      },
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
      },
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

    // Create Partnership with Funding type, which will add budget records
    await createPartnership(app, {
      projectId: project.id,
      changeset: changeset.id,
      types: [PartnerType.Funding],
      financialReportingType: undefined,
      mouStartOverride: undefined,
      mouEndOverride: undefined,
    });

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
      },
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

  it('project step', async () => {
    const project = await activeProject(app);
    const changeset = await createProjectChangeRequest(app, {
      projectId: project.id,
    });

    // Update project step with changeset
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
            step: ProjectStep.FinalizingCompletion,
          },
          changeset: changeset.id,
        },
      },
    );
    expect(mutationResult.updateProject.project.step.value).toBe(
      ProjectStep.FinalizingCompletion,
    );

    // Query project without changeset
    let result = await readProject(app, project.id);
    expect(result.project.step.value).toBe(ProjectStep.Active);

    // Query project with changeset
    result = await readProject(app, project.id, changeset.id);
    expect(result.project.step.value).toBe(ProjectStep.FinalizingCompletion);

    await approveProjectChangeRequest(app, changeset.id);

    // Project name is changed without changeset
    result = await readProject(app, project.id);
    expect(result.project.step.value).toBe(ProjectStep.FinalizingCompletion);
  });
});
