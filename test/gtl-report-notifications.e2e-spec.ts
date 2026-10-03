import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { type EmailMessage } from '@seedcompany/nestjs-email';
import { type ID, Role } from '~/common';
import { ConfigService } from '~/core/config';
import { MailerService } from '~/core/email';
import { Hooks } from '~/core/hooks';
import { graphql } from '~/graphql';
import { ResourceMutatedHook } from '../src/components/audit/resource-mutated.hook';
import { GtlReportStatus as Status } from '../src/components/gtl-report/dto';
import { type GtlReportStatusChangedProps } from '../src/components/gtl-report/workflow/emails/gtl-report-status-changed.email';
import { GtlReportWorkflow } from '../src/components/gtl-report/workflow/gtl-report-workflow';
import { GtlReportTransitionedHook } from '../src/components/gtl-report/workflow/hooks/gtl-report-transitioned.hook';
import { ProjectType } from '../src/components/project/dto';
import {
  createInternshipEngagement,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  registerUser,
  type TestApp,
  type TestUser,
} from './utility';
import {
  getGtlReportTransitions,
  transitionGtlReport,
} from './utility/transition-gtl-report';
import { GtlReportWorkflowTester } from './utility/workflow.tester';

type TransitionName = (typeof GtlReportWorkflow)['transition']['name'];
const transition = (name: TransitionName) =>
  GtlReportWorkflow.transitionByName(name);

type StatusChangedMessage = EmailMessage<GtlReportStatusChangedProps>;

/** Minimal block-editor document the RichText (JSONObject) scalar accepts. */
const doc = (text: string) => ({
  version: '1',
  time: 1,
  blocks: [{ id: text, type: 'paragraph', data: { text } }],
});
interface RichDoc {
  blocks: Array<{ data: { text: string } }>;
}
const textOf = (value: unknown) => (value as RichDoc).blocks[0]!.data.text;

// The emails a GTL report's status changes send out. Who hears about a
// transition is declared on the workflow; the person making the change never
// is. Email sending is off under jest, so the mailer's `send` is spied on and
// the composed messages are read back from it.
describe('GTL Report Notifications e2e', () => {
  let app: TestApp;
  let config: ConfigService;
  let send: ReturnType<typeof spyOnSend>;
  let projectManager: TestUser;
  let fieldPartnerA: TestUser;
  let fieldPartnerB: TestUser;
  let fieldOpsDirector: TestUser;
  let marketing: TestUser;
  /** The engagement's intern. NOT a project member. */
  let leader: TestUser;

  let projectId: ID;
  let reportId: ID;
  let report: GtlReportWorkflowTester;

  const spyOnSend = (app: TestApp) =>
    jest.spyOn(app.get(MailerService), 'send');

  beforeAll(async () => {
    app = await createTestApp({
      config: { gtlReportStatusChange: { enabled: true } },
    });
    config = app.get(ConfigService);
    send = spyOnSend(app);
    await createSession(app);

    projectManager = await registerUser(app, {
      roles: [Role.ProjectManager],
    });
    fieldPartnerA = await registerUser(app, { roles: [Role.FieldPartner] });
    fieldPartnerB = await registerUser(app, { roles: [Role.FieldPartner] });
    fieldOpsDirector = await registerUser(app, {
      roles: [Role.FieldOperationsDirector],
    });
    marketing = await registerUser(app, { roles: [Role.Marketing] });
    leader = await registerUser(app, { roles: [Role.Intern] });
  });

  // A fresh Internship project per test, led by `leader`. The project manager
  // creates it (and so is a member); the two field partners and the field
  // operations director are added as members. Marketing is deliberately NOT a
  // member: the Publish grant is global, and it shows the actor is left out
  // even when they would otherwise never have been a recipient.
  beforeEach(async () => {
    send.mockClear();
    await projectManager.login();
    const project = await createProject(app, {
      type: ProjectType.Internship,
      mouStart: '2020-01-01',
      mouEnd: '2020-12-31',
    });
    projectId = project.id;
    const engagement = await createInternshipEngagement(app, {
      project: project.id,
      intern: leader.id,
      startDateOverride: '2020-01-01',
      endDateOverride: '2020-12-31',
    });
    for (const [user, role] of [
      [fieldPartnerA, Role.FieldPartner],
      [fieldPartnerB, Role.FieldPartner],
      [fieldOpsDirector, Role.FieldOperationsDirector],
    ] as const) {
      await createProjectMember(app, {
        project: project.id,
        user: user.id,
        roles: [role],
      });
    }
    reportId = await firstGtlReport(app, engagement.id);
    report = await GtlReportWorkflowTester.for(app, reportId);
    // Fixture setup sends nothing, but be sure the assertions start clean.
    send.mockClear();
  });

  afterEach(() => {
    Object.assign(config.gtlReportStatusChange, { enabled: true });
  });

  const email = (user: TestUser) => user.email.value!;

  /** Who each composed message is addressed to, sorted for comparison. */
  const recipients = () =>
    send.mock.calls
      .flatMap(([message]) =>
        message.primaryRecipients.map((to) =>
          typeof to === 'string' ? to : to.address,
        ),
      )
      .toSorted();

  /** The props of the message addressed to this user. */
  const messageTo = (user: TestUser) => {
    const found = send.mock.calls.find(([message]) =>
      message.primaryRecipients.includes(email(user)),
    );
    if (!found) {
      throw new Error(`No email was sent to ${email(user)}`);
    }
    return (found[0] as StatusChangedMessage).body.props;
  };

  it('Send to Supervisor emails the other field partner and the project manager, not the sender', async () => {
    await fieldPartnerA.login();
    await report.executeByLabel('Start');
    // Starting a draft notifies nobody.
    expect(send).not.toHaveBeenCalled();

    await report.executeByLabel('Send to Supervisor');
    expect(report.state).toBe(Status.PendingSupervisorSignOff);

    expect(recipients()).toEqual(
      [email(projectManager), email(fieldPartnerB)].toSorted(),
    );
    expect(send).toHaveBeenCalledTimes(2);

    const props = messageTo(projectManager);
    expect(props.previousStatusVal).toBe(Status.InProgress);
    expect(props.newStatusVal).toBe(Status.PendingSupervisorSignOff);
    expect(props.recipient.email.value).toBe(email(projectManager));
    expect(props.changedBy?.id).toBe(fieldPartnerA.id);
    expect(props.report.id).toBe(reportId);
    expect(props.leader.id).toBe(leader.id);
    // The project manager may read the leader's name.
    expect(props.leader.displayFirstName?.value).toBe(
      leader.displayFirstName.value,
    );
  });

  it('Publish emails the leader along with the field partners, project manager and director', async () => {
    // Placed by an administrator (a bypass), which emails nobody.
    await report.forceTo(Status.Approved);
    expect(send).not.toHaveBeenCalled();

    await marketing.login();
    await report.executeByLabel('Publish');
    expect(report.state).toBe(Status.Published);

    expect(recipients()).toEqual(
      [
        email(leader),
        email(projectManager),
        email(fieldPartnerA),
        email(fieldPartnerB),
        email(fieldOpsDirector),
      ].toSorted(),
    );

    // The leader's own email names them (a user may read their own name)
    // and carries the change.
    const toLeader = messageTo(leader);
    expect(toLeader.leader.id).toBe(leader.id);
    expect(toLeader.leader.displayFirstName?.value).toBe(
      leader.displayFirstName.value,
    );
    expect(toLeader.leader.displayLastName?.value).toBe(
      leader.displayLastName.value,
    );
    expect(toLeader.recipient.email.value).toBe(email(leader));
    expect(toLeader.previousStatusVal).toBe(Status.Approved);
    expect(toLeader.newStatusVal).toBe(Status.Published);
    expect(toLeader.changedBy?.id).toBe(marketing.id);
    // A consequence of policy, not a goal: the leader is not on the project,
    // so its name is withheld from them and the template shows its
    // placeholder. The email still goes out. A member recipient sees it.
    expect(toLeader.project.id).toBe(projectId);
    expect(toLeader.project.name.canRead).toBe(false);
    expect(messageTo(projectManager).project.name.canRead).toBe(true);
  });

  it('Request Changes carries the reviewer’s notes to the field partners and the leader', async () => {
    await report.forceTo(Status.InReview);
    send.mockClear();

    await projectManager.login();
    await transitionGtlReport(app, {
      report: reportId,
      transition: transition('Request Changes').key,
      notes: doc('please expand the community impact section'),
    });

    expect(recipients()).toEqual(
      [email(fieldPartnerA), email(fieldPartnerB), email(leader)].toSorted(),
    );
    const toFieldPartner = messageTo(fieldPartnerA);
    expect(toFieldPartner.newStatusVal).toBe(Status.InProgress);
    expect(toFieldPartner.workflowEvent.notes.canRead).toBe(true);
    expect(textOf(toFieldPartner.workflowEvent.notes.value)).toBe(
      'please expand the community impact section',
    );
  });

  it('a refused transition sends nothing', async () => {
    await fieldPartnerA.login();
    await report.executeByLabel('Start');
    await report.executeByLabel('Send to Supervisor');
    send.mockClear();

    // The sender may not sign off their own report.
    await expect(
      transitionGtlReport(app, {
        report: reportId,
        transition: transition('Sign Off & Submit').key,
      }),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
    expect((await getGtlReportTransitions(app, reportId)).status.value).toBe(
      Status.PendingSupervisorSignOff,
    );
  });

  describe('when the mutation rolls back', () => {
    let hooksRun: ReturnType<typeof spyOnHooksRun> | undefined;
    const spyOnHooksRun = (app: TestApp) => jest.spyOn(app.get(Hooks), 'run');

    afterEach(() => {
      hooksRun?.mockRestore();
      hooksRun = undefined;
    });

    it('sends nothing and leaves the status where it was', async () => {
      await fieldPartnerA.login();
      await report.executeByLabel('Start');
      send.mockClear();

      // The audit hook fires AFTER the notification handler has queued its
      // emails, so this proves the queue is thrown away with the transaction.
      const hooks = app.get(Hooks);
      const originalRun = hooks.run.bind(hooks);
      hooksRun = spyOnHooksRun(app).mockImplementation(async (hook) => {
        if (
          hook instanceof ResourceMutatedHook &&
          hook.resourceType === 'GTLReport'
        ) {
          throw new Error('audit log unavailable');
        }
        return await originalRun(hook);
      });

      await expect(
        transitionGtlReport(app, {
          report: reportId,
          transition: transition('Send to Supervisor').key,
        }),
      ).rejects.toThrow();

      // The notification handler did run (its hook was dispatched before the
      // one made to fail), so "nothing sent" means the queued emails were
      // discarded with the rollback — not that none were ever queued.
      expect(
        hooksRun.mock.calls.some(
          ([hook]) => hook instanceof GtlReportTransitionedHook,
        ),
      ).toBe(true);
      expect(send).not.toHaveBeenCalled();
      expect((await getGtlReportTransitions(app, reportId)).status.value).toBe(
        Status.InProgress,
      );
    });
  });

  it('sends nothing when the feature is off', async () => {
    Object.assign(config.gtlReportStatusChange, { enabled: false });

    await fieldPartnerA.login();
    await report.executeByLabel('Start');
    await report.executeByLabel('Send to Supervisor');
    expect(report.state).toBe(Status.PendingSupervisorSignOff);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends nothing for an administrator’s bypass', async () => {
    await report.forceTo(Status.InReview);
    await report.forceTo(Status.Published);
    expect(send).not.toHaveBeenCalled();
  });
});

/** The earliest quarterly GTL report of the engagement. */
async function firstGtlReport(app: TestApp, engagement: ID): Promise<ID> {
  const result = await app.graphql.query(
    graphql(`
      query FirstGtlReportForNotificationsTest($id: ID!) {
        internshipEngagement(id: $id) {
          gtlReports {
            items {
              id
              start
              end
            }
          }
        }
      }
    `),
    { id: engagement },
  );
  const quarters = result.internshipEngagement.gtlReports.items
    .filter((item) => item.start !== item.end)
    .toSorted((a, b) => a.start.localeCompare(b.start));
  const first = quarters[0];
  if (!first) {
    throw new Error('The engagement has no GTL reports');
  }
  return first.id;
}
