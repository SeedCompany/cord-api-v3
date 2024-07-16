import { Role } from '~/common';
import { EngagementStatus } from '../src/components/engagement/dto';
import {
  createFundingAccount,
  createLanguageEngagement,
  createLocation,
  createProject,
  createSession,
  createTestApp,
  registerUser,
  runAsAdmin,
  TestApp,
  TestUser,
} from './utility';
import { EngagementWorkflowTester } from './utility/engagement-workflow.tester';
import { RawLanguageEngagement, RawProject } from './utility/fragments';
import { forceProjectTo } from './utility/transition-project';

describe('Engagement-Workflow e2e', () => {
  let app: TestApp;
  let projectManager: TestUser;
  let controller: TestUser;
  let project: RawProject;
  let engagement: RawLanguageEngagement;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);

    controller = await registerUser(app, {
      roles: [Role.Controller],
    });
    projectManager = await registerUser(app, {
      roles: [Role.ProjectManager],
    });

    const location = await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccountId: fundingAccount.id,
      });
      return location;
    });
    project = await createProject(app, {
      primaryLocationId: location.id,
    });

    engagement = await createLanguageEngagement(app, {
      projectId: project.id,
    });
    await forceProjectTo(app, project.id, 'Active');
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await projectManager.login();
  });

  it('Start Late', async () => {
    const lateEng = await createLanguageEngagement(app, {
      projectId: project.id,
    });
    const eng = await EngagementWorkflowTester.for(app, lateEng.id);
    expect(eng.state).toBe(EngagementStatus.InDevelopment);

    await controller.login();
    await eng.executeByLabel('Approve');
    expect(eng.state).toBe(EngagementStatus.Active);
  });

  it('End Early', async () => {
    const eng = await EngagementWorkflowTester.for(app, engagement.id);
    expect(eng.state).toBe(EngagementStatus.Active);

    await eng.executeByLabel('Finalize Completion');

    await controller.login();
    await eng.executeByState('Completed');
    expect(eng.state).toBe(EngagementStatus.Completed);
  });
});
