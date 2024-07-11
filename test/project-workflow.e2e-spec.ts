import { CalendarDate, Role } from '~/common';
import { Language } from '../src/components/language/dto';
import { Location } from '../src/components/location/dto';
import { PartnerType } from '../src/components/partner/dto';
import {
  ProjectStatus,
  ProjectStep,
  ProjectType,
} from '../src/components/project/dto';
import {
  createDirectProduct,
  createFundingAccount,
  createLanguage,
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
import { ProjectWorkflowTester } from './utility/workflow.tester';

describe('Project-Workflow e2e', () => {
  let app: TestApp;
  let fieldOpsDirector: TestUser;
  let projectManager: TestUser;
  let consultantManager: TestUser;
  let financialAnalyst: TestUser;
  let controller: TestUser;
  let location: Location;
  let language: Language;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);

    // Register several testers with different roles
    fieldOpsDirector = await registerUser(app, {
      roles: [Role.FieldOperationsDirector],
    });
    projectManager = await registerUser(app, {
      roles: [Role.ProjectManager],
    });
    consultantManager = await registerUser(app, {
      roles: [Role.ConsultantManager],
    });
    financialAnalyst = await registerUser(app, {
      roles: [Role.FinancialAnalyst],
    });
    controller = await registerUser(app, {
      roles: [Role.Controller],
    });
    await projectManager.login();

    location = await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });

      return location;
    });

    language = await runAsAdmin(app, createLanguage);
  });
  afterAll(async () => {
    await app.close();
  });

  it('should have project step', async () => {
    const project = await createProject(app);
    expect(project.step.value).toBe(ProjectStep.EarlyConversations);
    expect(project.status).toBe(ProjectStatus.InDevelopment);
  });

  // TODO move to budget e2e
  it('should have default status as Pending for first budget with project creation', async () => {
    const type = ProjectType.MomentumTranslation;
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
      },
    );
    expect(queryProject.project.budget.value.status).toBe('Pending');
  });

  it('General development user flow', async () => {
    // Create a new person
    const person = await createPerson(app);

    // Create a new project (single language)
    const project = await createProject(app);
    let languageEngagement = await createLanguageEngagement(app, {
      projectId: project.id,
    });
    expect(languageEngagement.id).toBeDefined();

    // Create a new project (cluster)
    languageEngagement = await createLanguageEngagement(app, {
      projectId: project.id,
      languageId: language.id,
    });

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
      },
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

    // TODO: Upload mock UBT file
    // TODO: Upload mock Approval docs
    // Add team members
    const projectMember = await createProjectMember(app, {
      projectId: project.id,
      userId: person.id,
    });
    expect(projectMember.user.value?.id).toBe(person.id);

    // Add partners
    await projectManager.login();
    const { partner } = await runAsAdmin(app, async () => {
      const partner = await createPartner(app, {
        types: [PartnerType.Funding, PartnerType.Impact, PartnerType.Technical],
        financialReportingTypes: [],
      });
      return { partner };
    });
    await createPartnership(app, {
      partnerId: partner.id,
      projectId: project.id,
      financialReportingType: undefined,
    });

    // Add products
    await createDirectProduct(app, {
      engagementId: languageEngagement.id,
    });
  });

  describe('Workflow', () => {
    let project: ProjectWorkflowTester;

    beforeEach(async () => {
      await projectManager.login();

      const createdProject = await createProject(app, {
        primaryLocationId: location.id,
      });
      await createProjectMember(app, {
        userId: financialAnalyst.id,
        projectId: createdProject.id,
        roles: [Role.FinancialAnalyst],
      });
      // Projects need an engagement to move out of Early Conversations
      await createLanguageEngagement(app, {
        projectId: createdProject.id,
        languageId: language.id,
      });
      project = await ProjectWorkflowTester.for(app, createdProject.id);
    });

    // TODO 2/3rds of the in development states can end development
    // This only covers one 🤷‍♂️
    it('End Development', async () => {
      await project.executeByLabel('Submit for Concept Approval');

      await fieldOpsDirector.login();
      await project.executeByLabel('Approve Concept');

      await projectManager.login();
      await project.executeByLabel('Submit for Consultant Endorsement');

      await consultantManager.login();
      await project.executeByLabel('Endorse Plan');

      await projectManager.login();
      await project.executeByLabel('Submit for Financial Endorsement');

      await financialAnalyst.login();
      await project.executeByLabel('Endorse Project Plan');

      await projectManager.login();
      await project.executeByLabel('End Development');
      expect(project.state).toBe(ProjectStep.DidNotDevelop);
    });

    it('Development Approval', async () => {
      await project.executeByLabel('Submit for Concept Approval');

      await fieldOpsDirector.login();
      await project.executeByLabel('Approve Concept');

      await projectManager.login();
      await project.executeByLabel('Submit for Consultant Endorsement');

      await consultantManager.login();
      await project.executeByLabel('Endorse Plan');

      await projectManager.login();
      await project.executeByLabel('Submit for Financial Endorsement');

      await financialAnalyst.login();
      await project.executeByLabel('Endorse Project Plan');

      await projectManager.login();
      await project.executeByLabel('Submit for Approval');

      await fieldOpsDirector.login(); // or RD
      await project.executeByLabel('Approve Project');

      await controller.login();
      await project.executeByState('Active');
    });

    it.each([
      ProjectStep.Active,
      ProjectStep.ActiveChangedPlan, //
    ])('Change to Plan from %s', async (startingState) => {
      await runAsAdmin(app, () => project.bypassTo(startingState));

      await project.executeByLabel('Discuss Change to Plan');
      expect(project.state).toBe(ProjectStep.DiscussingChangeToPlan);

      await project.executeByLabel('Submit for Approval');
      expect(project.state).toBe(ProjectStep.PendingChangeToPlanApproval);

      await fieldOpsDirector.login();
      await project.executeByLabel('Approve Change to Plan');
      expect(project.state).toBe(ProjectStep.PendingChangeToPlanConfirmation);

      await controller.login();
      await project.executeByLabel('Approve Change to Plan');
      expect(project.state).toBe(ProjectStep.ActiveChangedPlan);
    });

    it('Completion', async () => {
      await runAsAdmin(app, () => project.bypassTo('Active'));

      await project.executeByLabel('Finalize Completion');
      expect(project.state).toBe(ProjectStep.FinalizingCompletion);

      await financialAnalyst.login();
      await project.executeByState('Completed');
      expect(project.state).toBe(ProjectStep.Completed);
    });

    it.each([
      ProjectStep.Active,
      ProjectStep.ActiveChangedPlan, //
    ])('Suspension from %s', async (startingState) => {
      await runAsAdmin(app, () => project.bypassTo(startingState));

      await project.executeByLabel('Discuss Change to Plan');
      await project.executeByLabel('Discuss Suspension');
      expect(project.state).toBe(ProjectStep.DiscussingSuspension);
      await project.executeByLabel('Submit for Approval');
      expect(project.state).toBe(ProjectStep.PendingSuspensionApproval);

      await fieldOpsDirector.login();
      await project.executeByLabel('Approve Suspension');
      expect(project.state).toBe(ProjectStep.Suspended);

      await projectManager.login();
      await project.executeByLabel('Discuss Reactivation');
      expect(project.state).toBe(ProjectStep.DiscussingReactivation);
      await project.executeByLabel('Submit for Approval');
      expect(project.state).toBe(ProjectStep.PendingReactivationApproval);

      await fieldOpsDirector.login();
      await project.executeByLabel('Approve Reactivation');
      expect(project.state).toBe(ProjectStep.ActiveChangedPlan);
    });

    it.each([
      ProjectStep.Active,
      ProjectStep.ActiveChangedPlan,
      ProjectStep.Suspended,
    ])('Termination from %s', async (startingState) => {
      await runAsAdmin(app, () => project.bypassTo(startingState));

      await project.executeByLabel('Discuss Termination');
      expect(project.state).toBe(ProjectStep.DiscussingTermination);
      await project.executeByLabel('Submit for Approval');
      expect(project.state).toBe(ProjectStep.PendingTerminationApproval);

      await fieldOpsDirector.login();
      await project.executeByLabel('Approve Termination');
      expect(project.state).toBe(ProjectStep.Terminated);
    });
  });
});
