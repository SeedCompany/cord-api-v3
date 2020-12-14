/* eslint-disable @seedcompany/no-unused-vars */
import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { CalendarDate, Sensitivity, sleep } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { EngagementStatus } from '../src/components/engagement';
import { FieldRegion } from '../src/components/field-region';
import { FieldZone } from '../src/components/field-zone';
import { Location } from '../src/components/location';
import { PartnerType } from '../src/components/partner';
import {
  Project,
  ProjectStatus,
  ProjectStep,
  ProjectType,
  Role,
} from '../src/components/project';
import { User } from '../src/components/user/dto/user.dto';
import {
  createBudget,
  createFundingAccount,
  createInternshipEngagement,
  createLanguageEngagement,
  createLocation,
  createProject,
  createRegion,
  createSession,
  createTestApp,
  getCurrentEngagementStatus,
  login,
  registerUser,
  registerUserWithPower,
  runAsAdmin,
  TestApp,
  updateProject,
} from './utility';
import { resetDatabase } from './utility/reset-database';
import {
  changeLanguageEngagementStatus,
  transitionLangEngagementToActive,
} from './utility/transition-engagement';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
} from './utility/transition-project';

describe('Project-Workflow e2e', () => {
  let app: TestApp;
  let password: string;
  let director: User;
  let db: Connection;
  let projectManager: User;
  let consultantManager: User;
  let financialAnalyst: User;
  let financialAnalystController: User;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(Connection);
    await createSession(app);
    password = faker.internet.password();

    // Register several testers with different roles
    director = await registerUser(app, {
      roles: [Role.RegionalDirector, Role.FieldOperationsDirector],
      password: password,
    });
    projectManager = await registerUserWithPower(
      app,
      [
        Powers.CreateLanguage,
        Powers.CreateEthnologueLanguage,
        Powers.CreateOrganization,
      ],
      {
        roles: [Role.ProjectManager],
        password: password,
      }
    );
    consultantManager = await registerUser(app, {
      roles: [Role.Consultant, Role.ConsultantManager],
      password: password,
    });
    financialAnalyst = await registerUser(app, {
      roles: [Role.FinancialAnalyst],
      password: password,
    });
    financialAnalystController = await registerUser(app, {
      roles: [Role.FinancialAnalyst, Role.Controller],
      password: password,
    });
    await login(app, { email: projectManager.email.value, password });
  });
  afterAll(async () => {
    await resetDatabase(db);
    await app.close();
  });

  it("should have engagement status 'InDevelopment' when add language or internship engagement", async () => {
    // --- Translation Project with engagement
    const transProject = await createProject(app, {
      type: ProjectType.Translation,
    });
    expect(transProject.step.value).toBe(ProjectStep.EarlyConversations);

    const langEngagement = await createLanguageEngagement(app, {
      projectId: transProject.id,
    });
    expect(langEngagement.status.value).toBe(EngagementStatus.InDevelopment);

    // --- Intern Project with engagement
    const internProject = await createProject(app, {
      type: ProjectType.Internship,
    });
    const internEngagement = await createInternshipEngagement(app, {
      projectId: internProject.id,
    });
    expect(internEngagement.status.value).toBe(EngagementStatus.InDevelopment);
  });

  it('Translation: should test engagement status Active when Project is made Active', async function () {
    // --- Translation project
    const transProject = await createProject(app, {
      type: ProjectType.Translation,
    });
    const langEngagement = await createLanguageEngagement(app, {
      projectId: transProject.id,
    });
    await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      const fieldRegion = await createRegion(app);
      await updateProject(app, {
        id: transProject.id,
        primaryLocationId: location.id,
        fieldRegionId: fieldRegion.id,
      });
      for (const next of stepsFromEarlyConversationToBeforeActive) {
        await changeProjectStep(app, transProject.id, next);
      }
      await changeProjectStep(app, transProject.id, ProjectStep.Active);
    });
    const lEngagementStatus = await getCurrentEngagementStatus(
      app,
      langEngagement.id
    );
    expect(lEngagementStatus.status.value).toBe(EngagementStatus.Active);
  });

  it('Internship: should test engagement status Active when Project is made Active', async function () {
    // --- Internship project
    const internProject = await createProject(app, {
      type: ProjectType.Internship,
    });
    const internEngagement = await createInternshipEngagement(app, {
      projectId: internProject.id,
    });
    await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      const fieldRegion = await createRegion(app);
      await updateProject(app, {
        id: internProject.id,
        primaryLocationId: location.id,
        fieldRegionId: fieldRegion.id,
      });
      for (const next of stepsFromEarlyConversationToBeforeActive) {
        await changeProjectStep(app, internProject.id, next);
      }
      await changeProjectStep(app, internProject.id, ProjectStep.Active);
    });
    const lEngagementStatus = await getCurrentEngagementStatus(
      app,
      internEngagement.id
    );
    expect(lEngagementStatus.status.value).toBe(EngagementStatus.Active);
  });

  it('Workflow: engagement completed', async function () {
    // --- Engagement to Active
    const transProject = await createProject(app, {
      type: ProjectType.Translation,
    });
    const langEngagement = await createLanguageEngagement(app, {
      projectId: transProject.id,
    });
    await transitionLangEngagementToActive(
      app,
      transProject.id,
      langEngagement.id
    );
    await runAsAdmin(app, async function () {
      await changeProjectStep(
        app,
        transProject.id,
        ProjectStep.DiscussingChangeToPlan
      );
    });
    await changeLanguageEngagementStatus(
      app,
      langEngagement.id,
      EngagementStatus.DiscussingChangeToPlan
    );
    await changeLanguageEngagementStatus(
      app,
      langEngagement.id,
      EngagementStatus.ActiveChangedPlan
    );
    await runAsAdmin(app, async function () {
      await changeProjectStep(app, transProject.id, ProjectStep.Active);
    });
    await changeLanguageEngagementStatus(
      app,
      langEngagement.id,
      EngagementStatus.FinalizingCompletion
    );
    await changeLanguageEngagementStatus(
      app,
      langEngagement.id,
      EngagementStatus.Completed
    );
  });

  it('Workflow: engagement terminated', async function () {
    const transProject = await createProject(app, {
      type: ProjectType.Translation,
    });
    const langEngagement = await createLanguageEngagement(app, {
      projectId: transProject.id,
    });
    await transitionLangEngagementToActive(
      app,
      transProject.id,
      langEngagement.id
    );
    await changeLanguageEngagementStatus(
      app,
      langEngagement.id,
      EngagementStatus.DiscussingSuspension
    );
    await runAsAdmin(app, async function () {
      await changeProjectStep(
        app,
        transProject.id,
        ProjectStep.DiscussingChangeToPlan
      );
    });
    await changeLanguageEngagementStatus(
      app,
      langEngagement.id,
      EngagementStatus.Suspended
    );
    await changeLanguageEngagementStatus(
      app,
      langEngagement.id,
      EngagementStatus.DiscussingTermination
    );
    await changeLanguageEngagementStatus(
      app,
      langEngagement.id,
      EngagementStatus.Terminated
    );
  });
});
