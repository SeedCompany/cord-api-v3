import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { CalendarDate, sleep } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { EngagementStatus } from '../src/components/engagement';
import { Language } from '../src/components/language';
import { PlanChangeStatus } from '../src/components/plan-change/dto/plan-change-status.enum';
import { Role } from '../src/components/project';
import { User } from '../src/components/user/dto/user.dto';
import {
  createFundingAccount,
  createLanguage,
  createLanguageEngagement,
  createLocation,
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

const readProjectEnagements = (app: TestApp, id: string, changeset?: string) =>
  app.graphql.query(
    gql`
      query project($id: ID!, $changeset: ID) {
        project(id: $id, changeset: $changeset) {
          ...project
          engagements {
            items {
              id
              status {
                value
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

const readLanguageEngagement = (app: TestApp, id: string, changeset?: string) =>
  app.graphql.query(
    gql`
      query engagement($id: ID!, $changeset: ID) {
        engagement(id: $id, changeset: $changeset) {
          ...languageEngagement
        }
      }
      ${fragments.languageEngagement}
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
  const project = await createProject(app);
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

const updateChangeset = (app: TestApp, id: string, status: PlanChangeStatus) =>
  app.graphql.mutate(
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
          id,
          status,
        },
      },
    }
  );

describe('Engagement CR Aware e2e', () => {
  let app: TestApp;
  let director: User;
  let db: Connection;
  const password = faker.internet.password();
  let language: Language;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);

    director = await registerUserWithPower(
      app,
      [Powers.CreateLanguage, Powers.CreateEthnologueLanguage],
      {
        roles: [Role.ProjectManager, Role.Administrator],
        password: password,
      }
    );

    await login(app, { email: director.email.value, password });
    language = await createLanguage(app);
  });

  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it('New Engagement CR aware', async () => {
    const project = await activeProject(app);
    const planChange = await createPlanChange(app, {
      projectId: project.id,
    });
    expect(planChange.id).toBeTruthy();

    // Create new engagement with changeset
    const changesetEngagement = await app.graphql.mutate(
      gql`
        mutation createLanguageEngagement(
          $input: CreateLanguageEngagementInput!
        ) {
          createLanguageEngagement(input: $input) {
            engagement {
              ...languageEngagement
            }
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        input: {
          engagement: {
            languageId: language.id,
            projectId: project.id,
            status: EngagementStatus.InDevelopment,
          },
          changeset: planChange.id,
        },
      }
    );
    // list engagements without changeset
    let result = await readProjectEnagements(app, project.id);
    expect(result.project.engagements.items.length).toBe(0);
    // list engagements with changeset
    result = await readProjectEnagements(app, project.id, planChange.id);
    expect(result.project.engagements.items.length).toBe(1);
    expect(result.project.engagements.items[0].id).toBe(
      changesetEngagement.createLanguageEngagement.engagement.id
    );
    // aprove changeset
    await updateChangeset(app, planChange.id, PlanChangeStatus.Approved);
    result = await readProjectEnagements(app, project.id);
    expect(result.project.engagements.items.length).toBe(1);
  });

  it('Engagement props CR aware', async () => {
    const project = await activeProject(app);
    const planChange = await createPlanChange(app, {
      projectId: project.id,
    });
    const languageEngagement = await createLanguageEngagement(app, {
      languageId: language.id,
      projectId: project.id,
      status: EngagementStatus.InDevelopment,
    });
    // Update engagement prop with changeset
    await app.graphql.mutate(
      gql`
        mutation updateLanguageEngagement(
          $input: UpdateLanguageEngagementInput!
        ) {
          updateLanguageEngagement(input: $input) {
            engagement {
              ...languageEngagement
            }
          }
        }
        ${fragments.languageEngagement}
      `,
      {
        input: {
          engagement: {
            id: languageEngagement.id,
            completeDate: CalendarDate.fromISO('2100-08-22'),
          },
          changeset: planChange.id,
        },
      }
    );

    // read engagement without changeset
    let result = await readLanguageEngagement(app, languageEngagement.id);
    expect(result.engagement.completeDate.value !== '2100-08-22').toBeTruthy();
    // read engagement with changeset
    result = await readLanguageEngagement(
      app,
      languageEngagement.id,
      planChange.id
    );
    expect(result.engagement.completeDate.value).toBe('2100-08-22');
    // approve changeset
    await updateChangeset(app, planChange.id, PlanChangeStatus.Approved);
    await sleep(1000);
    result = await readLanguageEngagement(app, languageEngagement.id);
    expect(result.engagement.completeDate.value).toBe('2100-08-22');
  });
});
