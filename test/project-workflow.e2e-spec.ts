import { CalendarDate } from '../src/common';
import { Role } from '../src/components/authorization';
import { PartnerType } from '../src/components/partner';
import {
  ProjectStatus,
  ProjectStep,
  ProjectType,
} from '../src/components/project';
import {
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
  gql,
  registerUser,
  runAsAdmin,
  TestApp,
  TestUser,
  updateProject,
} from './utility';
import { createProduct } from './utility/create-product';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
} from './utility/transition-project';

describe('Project-Workflow e2e', () => {
  let app: TestApp;
  let fieldOpsDirector: TestUser;
  let consultantManager: TestUser;
  let financialAnalyst: TestUser;
  let controller: TestUser;
  let financialAnalystController: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);

    // Register several testers with different roles
    fieldOpsDirector = await registerUser(app, {
      roles: [Role.FieldOperationsDirector],
    });
    consultantManager = await registerUser(app, {
      roles: [Role.ConsultantManager],
    });
    financialAnalyst = await registerUser(app, {
      roles: [Role.FinancialAnalyst],
    });
    financialAnalystController = await registerUser(app, {
      roles: [Role.Controller],
    });
    controller = financialAnalystController;

    await fieldOpsDirector.login();
  });
  afterAll(async () => {
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
      await fieldOpsDirector.login();
    });

    it('Step 1. Create Project', async () => {
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
      const [location, fieldRegion] = await runAsAdmin(app, async () => {
        const fundingAccount = await createFundingAccount(app);
        const location = await createLocation(app, {
          fundingAccountId: fundingAccount.id,
        });
        const fieldRegion = await createRegion(app);

        return [location, fieldRegion];
      });
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
      await fieldOpsDirector.login();
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

      expect(result.step.value).toBe(ProjectStep.EarlyConversations);

      // TODO: Upload mock UBT file
      // TODO: Upload mock Approval docs
      // Add team members
      const projectMember = await createProjectMember(app, {
        projectId: project.id,
        userId: person.id,
      });
      expect(projectMember.user.value?.id).toBe(person.id);

      // Add partners
      await controller.login();
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
      await fieldOpsDirector.login();
      await createProduct(app, {
        engagementId: languageEngagement.id,
      });
    });

    it('Step 2. Did Not Develop', async () => {
      await fieldOpsDirector.login();
      const project = await createProject(app);
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingConceptApproval
      );
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

      await consultantManager.login();
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PrepForFinancialEndorsement
      );

      await fieldOpsDirector.login();
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingFinancialEndorsement
      );

      await controller.login();
      await createProjectMember(app, {
        userId: financialAnalyst.id,
        projectId: project.id,
        roles: [Role.FinancialAnalyst],
      });
      await financialAnalyst.login();
      await changeProjectStep(app, project.id, ProjectStep.FinalizingProposal);

      await fieldOpsDirector.login();
      await changeProjectStep(app, project.id, ProjectStep.DidNotDevelop);
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
      expect(result.project.step.value).toBe(ProjectStep.DidNotDevelop);
      expect(result.project.status).toBe(ProjectStatus.DidNotDevelop);
    });

    it('Step 2. Approval', async () => {
      const location = await runAsAdmin(app, async () => {
        const fundingAccount = await createFundingAccount(app);
        const location = await createLocation(app, {
          fundingAccountId: fundingAccount.id,
        });

        return location;
      });
      const project = await createProject(app, {
        primaryLocationId: location.id,
      });

      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingConceptApproval
      );

      await fieldOpsDirector.login();
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

      await consultantManager.login();
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PrepForFinancialEndorsement
      );

      await fieldOpsDirector.login();
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingFinancialEndorsement
      );

      await financialAnalystController.login();
      await changeProjectStep(app, project.id, ProjectStep.FinalizingProposal);

      await fieldOpsDirector.login();
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingRegionalDirectorApproval
      );
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingFinanceConfirmation
      );

      await controller.login();
      await changeProjectStep(app, project.id, ProjectStep.Active);

      /**
       * Step3. Change to Plan Workflow
       *  */
      await fieldOpsDirector.login();
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
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.PendingChangeToPlanConfirmation
      );

      await controller.login();
      await changeProjectStep(app, project.id, ProjectStep.ActiveChangedPlan);

      await fieldOpsDirector.login();
      await changeProjectStep(
        app,
        project.id,
        ProjectStep.FinalizingCompletion
      );
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

    it('Suspension', async () => {
      const location = await runAsAdmin(app, async () => {
        const fundingAccount = await createFundingAccount(app);
        const location = await createLocation(app, {
          fundingAccountId: fundingAccount.id,
        });

        return location;
      });
      const project = await createProject(app, {
        primaryLocationId: location.id,
      });

      await runAsAdmin(app, async () => {
        for (const next of stepsFromEarlyConversationToBeforeActive) {
          await changeProjectStep(app, project.id, next);
        }
      });

      await controller.login();
      await changeProjectStep(app, project.id, ProjectStep.Active);

      await fieldOpsDirector.login();
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

    it('Termination', async () => {
      const location = await runAsAdmin(app, async () => {
        const fundingAccount = await createFundingAccount(app);
        const location = await createLocation(app, {
          fundingAccountId: fundingAccount.id,
        });

        return location;
      });
      const project = await createProject(app, {
        primaryLocationId: location.id,
      });

      await runAsAdmin(app, async () => {
        for (const next of stepsFromEarlyConversationToBeforeActive) {
          await changeProjectStep(app, project.id, next);
        }
      });

      await controller.login();
      await changeProjectStep(app, project.id, ProjectStep.Active);

      await fieldOpsDirector.login();
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
