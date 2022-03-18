import { Role } from '../src/components/authorization';
import { EngagementStatus } from '../src/components/engagement';
import { ProjectStep, ProjectType } from '../src/components/project';
import {
  createFundingAccount,
  createInternshipEngagement,
  createLanguageEngagement,
  createLocation,
  createProject,
  createRegion,
  createSession,
  createTestApp,
  getCurrentEngagementStatus,
  registerUser,
  runAsAdmin,
  TestApp,
  updateProject,
} from './utility';
import {
  changeLanguageEngagementStatus,
  transitionEngagementToActive,
} from './utility/transition-engagement';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
} from './utility/transition-project';

describe('Engagement-Workflow e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);

    await registerUser(app, {
      roles: [Role.ProjectManager, Role.Controller],
    });
  });
  afterAll(async () => {
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

  describe('should test engagement status Active when Project is made Active', () => {
    it('translation', async function () {
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
    it('internship', async function () {
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
  });

  describe('Workflow', () => {
    it('engagement completed', async function () {
      // --- Engagement to Active
      const transProject = await createProject(app, {
        type: ProjectType.Translation,
      });
      const langEngagement = await createLanguageEngagement(app, {
        projectId: transProject.id,
      });
      await transitionEngagementToActive(
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

    it('engagement terminated', async function () {
      const transProject = await createProject(app, {
        type: ProjectType.Translation,
      });
      const langEngagement = await createLanguageEngagement(app, {
        projectId: transProject.id,
      });
      await transitionEngagementToActive(
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
        EngagementStatus.DiscussingSuspension
      );
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
});
