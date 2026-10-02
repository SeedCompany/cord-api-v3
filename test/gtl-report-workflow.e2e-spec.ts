import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { type ID, Role } from '~/common';
import { graphql } from '~/graphql';
import { GtlReportStatus as Status } from '../src/components/gtl-report/dto';
import { GtlReportWorkflow } from '../src/components/gtl-report/workflow/gtl-report-workflow';
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
  forceGtlReportTo,
  getGtlReportTransitions,
  transitionGtlReport,
} from './utility/transition-gtl-report';
import { GtlReportWorkflowTester } from './utility/workflow.tester';

type TransitionName = (typeof GtlReportWorkflow)['transition']['name'];
const transition = (name: TransitionName) =>
  GtlReportWorkflow.transitionByName(name);

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

// The GTL quarterly report's workflow, with the supervisor sign-off step that
// the Progress Report does not have. Field Partner and Project Manager grants
// are member-conditioned; Regional Director, Field Operations Director and
// Marketing act globally.
describe('GTL Report Workflow e2e', () => {
  let app: TestApp;
  let projectManager: TestUser;
  let fieldPartnerA: TestUser;
  let fieldPartnerB: TestUser;
  let regionalDirector: TestUser;
  let fieldOpsDirector: TestUser;
  let marketing: TestUser;
  /** A Project Manager who is NOT on the project. */
  let outsider: TestUser;

  let projectId: ID;
  let reportId: ID;
  let report: GtlReportWorkflowTester;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);

    projectManager = await registerUser(app, {
      roles: [Role.ProjectManager],
    });
    fieldPartnerA = await registerUser(app, { roles: [Role.FieldPartner] });
    fieldPartnerB = await registerUser(app, { roles: [Role.FieldPartner] });
    regionalDirector = await registerUser(app, {
      roles: [Role.RegionalDirector],
    });
    fieldOpsDirector = await registerUser(app, {
      roles: [Role.FieldOperationsDirector],
    });
    marketing = await registerUser(app, { roles: [Role.Marketing] });
    outsider = await registerUser(app, { roles: [Role.ProjectManager] });
  });

  // A fresh Internship project per test. The project manager creates it (and
  // so becomes a member); the two field partners are added as members. The
  // engagement's dates match the MOU window so its GTL reports are exactly the
  // four quarters of 2020 plus the final report.
  beforeEach(async () => {
    await projectManager.login();
    const project = await createProject(app, {
      type: ProjectType.Internship,
      mouStart: '2020-01-01',
      mouEnd: '2020-12-31',
    });
    projectId = project.id;
    const engagement = await createInternshipEngagement(app, {
      project: project.id,
      startDateOverride: '2020-01-01',
      endDateOverride: '2020-12-31',
    });
    for (const fieldPartner of [fieldPartnerA, fieldPartnerB]) {
      await createProjectMember(app, {
        project: project.id,
        user: fieldPartner.id,
        roles: [Role.FieldPartner],
      });
    }
    reportId = await firstGtlReport(app, engagement.id);
    report = await GtlReportWorkflowTester.for(app, reportId);
  });

  it('moves through all seven states with the right roles', async () => {
    expect(report.state).toBe(Status.NotStarted);

    await fieldPartnerA.login();
    await report.executeByLabel('Start');
    expect(report.state).toBe(Status.InProgress);
    await report.executeByLabel('Send to Supervisor');
    expect(report.state).toBe(Status.PendingSupervisorSignOff);

    await fieldPartnerB.login();
    await report.executeByLabel('Sign Off and Submit for Review');
    expect(report.state).toBe(Status.InReview);

    await regionalDirector.login();
    await report.executeByLabel('Send for Translation');
    expect(report.state).toBe(Status.PendingTranslation);

    await fieldOpsDirector.login();
    await report.executeByLabel('Ready for Review');
    expect(report.state).toBe(Status.InReview);

    await projectManager.login();
    await report.executeByLabel('Approve');
    expect(report.state).toBe(Status.Approved);

    await marketing.login();
    await report.executeByLabel('Publish');
    expect(report.state).toBe(Status.Published);
  });

  describe('who may execute each transition', () => {
    type Actor =
      | 'ProjectManager'
      | 'FieldPartner'
      | 'RegionalDirector'
      | 'FieldOperationsDirector'
      | 'Marketing'
      | 'Outsider';
    const actors = (): Record<Actor, TestUser> => ({
      ProjectManager: projectManager,
      FieldPartner: fieldPartnerA,
      RegionalDirector: regionalDirector,
      FieldOperationsDirector: fieldOpsDirector,
      Marketing: marketing,
      Outsider: outsider,
    });

    const fieldSide: Actor[] = ['FieldPartner', 'ProjectManager'];
    const reviewSide: Actor[] = [
      'ProjectManager',
      'RegionalDirector',
      'FieldOperationsDirector',
    ];

    const matrix: Array<[TransitionName, Status, Actor[]]> = [
      ['Start', Status.NotStarted, fieldSide],
      ['Send to Supervisor', Status.InProgress, fieldSide],
      ['Withdraw', Status.PendingSupervisorSignOff, fieldSide],
      ['Sign Off & Submit', Status.PendingSupervisorSignOff, fieldSide],
      ['Send for Translation', Status.InProgress, reviewSide],
      ['Ready for Review', Status.PendingTranslation, reviewSide],
      ['Request Changes', Status.InReview, reviewSide],
      ['Approve', Status.InReview, reviewSide],
      ['Publish', Status.Approved, ['Marketing', 'FieldOperationsDirector']],
    ];

    it.each(matrix)(
      '"%s" from %s is offered to %j and refused to everyone else',
      async (name, from, allowed) => {
        const { label, key, to } = transition(name);
        // Placed by an administrator, so the sign-off rule's "sender" is the
        // admin and restricts none of the roles under test.
        await report.forceTo(from);

        const offeredTo: Actor[] = [];
        for (const [actor, user] of Object.entries(actors()) as Array<
          [Actor, TestUser]
        >) {
          await user.login();
          if (await report.transitionByLabel(label)) {
            offeredTo.push(actor);
          } else {
            // Not offered, and not executable by key either.
            await expect(
              transitionGtlReport(app, { report: reportId, transition: key }),
            ).rejects.toThrow();
          }
        }
        expect(offeredTo.toSorted()).toEqual([...allowed].toSorted());

        // And an allowed role really can take it.
        await actors()[allowed[0]!].login();
        await report.executeByLabel(label);
        expect(report.state).toBe(to);
      },
    );
  });

  it('can be sent for translation from In Progress and from In Review', async () => {
    await projectManager.login();

    await report.forceTo(Status.InProgress);
    await report.executeByLabel('Send for Translation');
    expect(report.state).toBe(Status.PendingTranslation);

    await report.forceTo(Status.InReview);
    await report.executeByLabel('Send for Translation');
    expect(report.state).toBe(Status.PendingTranslation);
  });

  it('Request Changes sends the report back to In Progress', async () => {
    await report.forceTo(Status.InReview);
    await projectManager.login();
    await report.executeByLabel('Request Changes');
    expect(report.state).toBe(Status.InProgress);
  });

  it('Withdraw returns the report to the author, for a field partner or the project manager', async () => {
    await fieldPartnerA.login();
    await report.executeByLabel('Start');
    await report.executeByLabel('Send to Supervisor');
    await report.executeByLabel('Withdraw to Make Changes');
    expect(report.state).toBe(Status.InProgress);

    await report.executeByLabel('Send to Supervisor');
    await projectManager.login();
    await report.executeByLabel('Withdraw to Make Changes');
    expect(report.state).toBe(Status.InProgress);
  });

  describe('supervisor sign-off', () => {
    const signOff = transition('Sign Off & Submit');

    it('the field partner who sent the report cannot sign it off; another field partner can', async () => {
      await fieldPartnerA.login();
      await report.executeByLabel('Start');
      await report.executeByLabel('Send to Supervisor');

      // Still shown to the sender, greyed out with the reason.
      const asSender = (await report.all()).find((t) => t.key === signOff.key);
      expect(asSender).toBeDefined();
      expect(asSender!.disabled).toBe(true);
      expect(asSender!.disabledReason).toMatch(
        /another project member must sign off/,
      );
      expect(await report.transitionByLabel(signOff.label)).toBeUndefined();
      await expect(
        transitionGtlReport(app, {
          report: reportId,
          transition: signOff.key,
        }),
      ).rejects.toThrow();
      expect(report.state).toBe(Status.PendingSupervisorSignOff);

      await fieldPartnerB.login();
      await report.executeByLabel(signOff.label);
      expect(report.state).toBe(Status.InReview);
    });

    it('the project manager can sign off when they were not the sender', async () => {
      await fieldPartnerA.login();
      await report.executeByLabel('Start');
      await report.executeByLabel('Send to Supervisor');

      await projectManager.login();
      const asManager = (await report.all()).find((t) => t.key === signOff.key);
      expect(asManager?.disabled).toBe(false);
      await report.executeByLabel(signOff.label);
      expect(report.state).toBe(Status.InReview);
    });

    it('a project manager who sent the report cannot sign it off; a field partner can', async () => {
      await projectManager.login();
      await report.executeByLabel('Start');
      await report.executeByLabel('Send to Supervisor');

      expect(await report.transitionByLabel(signOff.label)).toBeUndefined();
      await expect(
        transitionGtlReport(app, {
          report: reportId,
          transition: signOff.key,
        }),
      ).rejects.toThrow();

      await fieldPartnerA.login();
      await report.executeByLabel(signOff.label);
      expect(report.state).toBe(Status.InReview);
    });
  });

  it('a user who is not on the project sees no transitions, cannot execute, and sees no history', async () => {
    await fieldPartnerA.login();
    await report.executeByLabel('Start');

    await outsider.login();
    const asOutsider = await getGtlReportTransitions(app, reportId);
    expect(asOutsider.status.canRead).toBe(false);
    expect(asOutsider.status.transitions).toEqual([]);
    await expect(
      transitionGtlReport(app, {
        report: reportId,
        transition: transition('Send to Supervisor').key,
      }),
    ).rejects.toThrow();
    expect(await workflowEvents(app, reportId)).toEqual([]);

    // Positive control on the same user: once a member, the same reads answer.
    await projectManager.login();
    await createProjectMember(app, {
      project: projectId,
      user: outsider.id,
      roles: [Role.ProjectManager],
    });
    await outsider.login();
    const asMember = await getGtlReportTransitions(app, reportId);
    expect(asMember.status.canRead).toBe(true);
    expect(asMember.status.transitions.length).toBeGreaterThan(0);
    expect(await workflowEvents(app, reportId)).toHaveLength(1);
  });

  it('keeps notes and lists events oldest first with who did them', async () => {
    await fieldPartnerA.login();
    await transitionGtlReport(app, {
      report: reportId,
      transition: transition('Start').key,
      notes: doc('kicking off'),
    });
    await transitionGtlReport(app, {
      report: reportId,
      transition: transition('Send to Supervisor').key,
      notes: doc('please review'),
    });

    await projectManager.login();
    const events = await workflowEvents(app, reportId);
    expect(events.map((event) => event.to)).toEqual([
      Status.InProgress,
      Status.PendingSupervisorSignOff,
    ]);
    expect(events.map((event) => event.transition?.key)).toEqual([
      transition('Start').key,
      transition('Send to Supervisor').key,
    ]);
    expect(events.map((event) => event.transition?.label)).toEqual([
      'Start',
      'Send to Supervisor',
    ]);
    expect(events.map((event) => textOf(event.notes.value))).toEqual([
      'kicking off',
      'please review',
    ]);
    for (const event of events) {
      expect(event.who.canRead).toBe(true);
      expect(event.who.value?.id).toBe(fieldPartnerA.id);
    }
  });

  it('an administrator can bypass the workflow; a project manager cannot', async () => {
    const asAdmin = await forceGtlReportTo(app, reportId, Status.Approved);
    expect(asAdmin.status.value).toBe(Status.Approved);
    expect(asAdmin.status.canBypassTransitions).toBe(true);

    await projectManager.login();
    const events = await workflowEvents(app, reportId);
    expect(events).toHaveLength(1);
    expect(events[0]!.transition).toBeNull();
    expect(events[0]!.to).toBe(Status.Approved);

    const asManager = await getGtlReportTransitions(app, reportId);
    expect(asManager.status.canBypassTransitions).toBe(false);
    await expect(
      transitionGtlReport(app, {
        report: reportId,
        bypassTo: Status.Published,
      }),
    ).rejects.toThrow();
    expect((await getGtlReportTransitions(app, reportId)).status.value).toBe(
      Status.Approved,
    );
  });
});

/** The earliest quarterly GTL report of the engagement. */
async function firstGtlReport(app: TestApp, engagement: ID): Promise<ID> {
  const result = await app.graphql.query(
    graphql(`
      query FirstGtlReportForWorkflowTest($id: ID!) {
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

async function workflowEvents(app: TestApp, id: ID) {
  const { report } = await app.graphql.query(
    graphql(`
      query GtlReportWorkflowEventsForTest($id: ID!) {
        report: periodicReport(id: $id) {
          __typename
          ... on GTLReport {
            workflowEvents {
              id
              at
              to
              transition {
                key
                label
                to
                type
              }
              notes {
                canRead
                value
              }
              who {
                canRead
                value {
                  id
                }
              }
            }
          }
        }
      }
    `),
    { id },
  );
  if (report.__typename !== 'GTLReport') {
    throw new Error(`Report ${id} is a ${report.__typename}, not a GTLReport`);
  }
  return report.workflowEvents;
}
