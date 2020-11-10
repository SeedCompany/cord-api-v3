/* eslint-disable @seedcompany/no-unused-vars */
import { gql } from 'apollo-server-core';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { CalendarDate, Sensitivity } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
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
  createLanguageEngagement,
  createLocation,
  createPartner,
  createPartnership,
  createPerson,
  createProject,
  createProjectMember,
  createRegion,
  createSession,
  createTestApp,
  fragments,
  login,
  registerUser,
  registerUserWithPower,
  runAsAdmin,
  TestApp,
  updateProject,
} from './utility';
import { createProduct } from './utility/create-product';
import { resetDatabase } from './utility/reset-database';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
} from './utility/transition-project';

describe('Project-Workflow e2e', () => {
  let app: TestApp;
  let password: string;
  let director: User;
  let fieldZone: FieldZone;
  let fieldRegion: FieldRegion;
  let location: Location;
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

  it('should have project step', async () => {
    const project = await createProject(app);
    expect(project.step.value).toBe(ProjectStep.EarlyConversations);
  });

  it('should have project status', async () => {
    const project = await createProject(app);
    expect(project.status).toBe(ProjectStatus.InDevelopment);
  });

  it('should have default status as Pending for first budget with project creation', async () => {
    const type = ProjectType.Translation;
    const project = await createProject(app, { type });

    const queryProject = await app.graphql.query(
      gql`
        query project($id: ID!) {
          project(id: $id) {
            ...project
            budget {
              value {
                id
                status
              }
              canRead
              canEdit
            }
          }
        }
        ${fragments.project}
      `,
      {
        id: project.id,
      }
    );
    expect(queryProject.project.budget.value.status).toBe('Pending');
  });

  describe('Workflow', () => {
    beforeEach(async () => {
      await login(app, { email: projectManager.email.value, password });
    });

    it('should test create project workflow', async () => {
      /**
       * Step1. Create Project
       *  */
      // Create a new person
      const person = await createPerson(app);
      expect(person.id).toBeDefined();

      // Create a new project (single language)
      const project = await createProject(app);
      let languageEngagement = await createLanguageEngagement(app, {
        projectId: project.id,
      });
      expect(languageEngagement.id).toBeDefined();

      // Create a new project (cluster)
      languageEngagement = await createLanguageEngagement(app, {
        projectId: project.id,
      });
      expect(languageEngagement.id).toBeDefined();

      // Enter location and field region
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      const fieldRegion = await createRegion(app);
      await updateProject(app, {
        id: project.id,
        primaryLocationId: location.id,
        fieldRegionId: fieldRegion.id,
      });

      let result = await app.graphql.query(
        gql`
          query project($id: ID!) {
            project(id: $id) {
              ...project
            }
          }
          ${fragments.project}
        `,
        {
          id: project.id,
        }
      );
      expect(result.project.primaryLocation.value.id).toBe(location.id);
      expect(result.project.fieldRegion.value.id).toBe(fieldRegion.id);

      // Enter MOU dates
      await login(app, { email: director.email.value, password });
      result = await updateProject(app, {
        id: project.id,
        mouStart: CalendarDate.fromISO('1991-01-01'),
        mouEnd: CalendarDate.fromISO('1992-01-01'),
      });
      expect(result.mouStart.value).toBe('1991-01-01');
      expect(result.mouEnd.value).toBe('1992-01-01');

      // Enter estimatedSubmission date
      result = await updateProject(app, {
        id: project.id,
        estimatedSubmission: CalendarDate.fromISO('2020-01-01'),
      });
      expect(result.estimatedSubmission.value).toBe('2020-01-01');

      // Enter Field budget
      const budget = await createBudget(app, { projectId: project.id });
      result = await app.graphql.query(
        gql`
          query project($id: ID!) {
            project(id: $id) {
              ...project
              budget {
                value {
                  ...budget
                }
              }
            }
          }
          ${fragments.project}
          ${fragments.budget}
        `,
        {
          id: project.id,
        }
      );
      expect(result.project.budget.value.id).toBe(budget.id);
      expect(result.project.step.value).toBe(ProjectStep.EarlyConversations);

      // TODO: Upload mock UBT file
      // TODO: Upload mock Approval docs
      // Add team members
      const projectMember = await createProjectMember(app, {
        projectId: project.id,
        userId: person.id,
      });
      expect(projectMember.user.value?.id).toBe(person.id);

      // Add partners
      await login(app, { email: projectManager.email.value, password });
      const partner = await createPartner(app, {
        types: [PartnerType.Funding, PartnerType.Impact, PartnerType.Technical],
        financialReportingTypes: [],
      });
      await createPartnership(app, {
        partnerId: partner.id,
        projectId: project.id,
        financialReportingType: undefined,
      });

      // Select sensitivity (Cannot update sensitivity if the project type is translation)
      // result = await updateProject(app, {
      //   id: project.id,
      //   sensitivity: Sensitivity.Medium,
      // });
      // expect(result.sensitivity).toBe(Sensitivity.Medium);

      // Add products
      await createProduct(app, {
        engagementId: languageEngagement.id,
      });
    });

    it('should test did not develop project workflow', async () => {
      /**
       * Step2. Did not develop workflow
       *  */
      const project = await createProject(app);
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingConceptApproval
      );

      // Login as Director
      await login(app, { email: director.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PrepForConsultantEndorsement
      );
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingConsultantEndorsement
      );

      // Login as Consultant Manager
      await login(app, { email: consultantManager.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PrepForFinancialEndorsement
      );

      // Login as Director
      await login(app, { email: director.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingFinancialEndorsement
      );

      // Login as Financial Analyst Controller
      await login(app, { email: financialAnalyst.email.value, password });
      await changeProjectStep(app, project.id, ProjectStep.FinalizingProposal);

      // Login as Director
      await login(app, { email: director.email.value, password });
      await changeProjectStep(app, project.id, ProjectStep.DidNotDevelop);
    });

    it('should test project workflow', async () => {
      /**
       * Step2. Approval Workflow
       *  */
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      const project = await createProject(app, {
        primaryLocationId: location.id,
      });

      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingConceptApproval
      );

      // Login as Director
      await login(app, { email: director.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PrepForConsultantEndorsement
      );
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingConsultantEndorsement
      );

      // Login as Consultant Manager
      await login(app, { email: consultantManager.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PrepForFinancialEndorsement
      );

      // Login as Director
      await login(app, { email: director.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingFinancialEndorsement
      );

      // Login as Financial Analyst Controller
      await login(app, {
        email: financialAnalystController.email.value,
        password,
      });
      await changeProjectStep(app, project.id, ProjectStep.FinalizingProposal);

      // Login as Project Manager
      await login(app, { email: projectManager.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingRegionalDirectorApproval
      );

      // Login as Director
      await login(app, { email: director.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingFinanceConfirmation
      );

      // Login as Controller
      await login(app, {
        email: financialAnalystController.email.value,
        password,
      });
      await changeProjectStep(app, project.id, ProjectStep.Active);

      /**
       * Step3. Change to Plan Workflow
       *  */
      // Login as Project Manager
      await login(app, { email: projectManager.email.value, password });
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.DiscussingChangeToPlan
      );
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingChangeToPlanApproval
      );

      // Login as Director
      await login(app, { email: director.email.value, password });
      await changeProjectStep(app, project.id, ProjectStep.ActiveChangedPlan);
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.FinalizingCompletion
      );

      // Login as Financial Analyst Controller
      await login(app, {
        email: financialAnalystController.email.value,
        password,
      });
      await changeProjectStep(app, project.id, ProjectStep.Completed);

      const result = await app.graphql.query(
        gql`
          query project($id: ID!) {
            project(id: $id) {
              ...project
            }
          }
          ${fragments.project}
        `,
        {
          id: project.id,
        }
      );
      expect(result.project.step.value).toBe(ProjectStep.Completed);
      expect(result.project.status).toBe(ProjectStatus.Completed);
    });

    it('should test project suspension workflow', async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      const project = await createProject(app, {
        primaryLocationId: location.id,
      });

      await runAsAdmin(app, async () => {
        for (const next of stepsFromEarlyConversationToBeforeActive) {
          await changeProjectStep(app, project.id, next);
        }
      });

      // Login as Controller
      await login(app, {
        email: financialAnalystController.email.value,
        password,
      });
      await changeProjectStep(app, project.id, ProjectStep.Active);

      // Login as Director
      await login(app, { email: director.email.value, password });
      const stepsFromActiveToPendingReactivationApproval = [
        ProjectStep.DiscussingChangeToPlan,
        ProjectStep.DiscussingSuspension,
        ProjectStep.PendingSuspensionApproval,
        ProjectStep.Suspended,
        ProjectStep.DiscussingReactivation,
        ProjectStep.PendingReactivationApproval,
      ];

      for (const next of stepsFromActiveToPendingReactivationApproval) {
        await changeProjectStep(app, project.id, next);
      }
      await changeProjectStep(app, project.id, ProjectStep.ActiveChangedPlan);
    });

    it('should test project termination workflow', async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      const project = await createProject(app, {
        primaryLocationId: location.id,
      });

      await runAsAdmin(app, async () => {
        for (const next of stepsFromEarlyConversationToBeforeActive) {
          await changeProjectStep(app, project.id, next);
        }
      });

      // Login as Controller
      await login(app, {
        email: financialAnalystController.email.value,
        password,
      });
      await changeProjectStep(app, project.id, ProjectStep.Active);

      // Login as Director
      await login(app, { email: director.email.value, password });
      const stepsFromActiveToPendingTerminationApproval = [
        ProjectStep.DiscussingChangeToPlan,
        ProjectStep.DiscussingSuspension,
        ProjectStep.PendingSuspensionApproval,
        ProjectStep.Suspended,
        ProjectStep.DiscussingTermination,
        ProjectStep.PendingTerminationApproval,
      ];

      for (const next of stepsFromActiveToPendingTerminationApproval) {
        await changeProjectStep(app, project.id, next);
      }
      await changeProjectStep(app, project.id, ProjectStep.Terminated);
    });
  });
});
