import { beforeAll, describe, expect, it } from '@jest/globals';
import { CalendarDate, type ID, Role } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { ProjectType } from '../src/components/project/dto';
import {
  createInternshipEngagement,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  errors,
  registerUser,
  type TestApp,
  type TestUser,
} from './utility';

// A Global Translation Leader's goals (#3968): they belong to the Internship
// engagement and carry across quarters; each GTL report says one thing about
// each goal. The goal's current status is DERIVED from its latest live entry
// on a live report, never stored on the goal.
describe('GTL Goal e2e', () => {
  let app: TestApp;
  let projectManager: TestUser;
  /** Added to every project created here. */
  let memberFieldPartner: TestUser;
  /** Never added to a project. */
  let outsiderFieldPartner: TestUser;
  /** A Project Manager who is NOT on the project; PMs can read projects, so
   * they can ask for the plan and get an empty one. */
  let outsiderProjectManager: TestUser;
  let marketing: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    projectManager = await registerUser(app, { roles: [Role.ProjectManager] });
    memberFieldPartner = await registerUser(app, {
      roles: [Role.FieldPartner],
    });
    outsiderFieldPartner = await registerUser(app, {
      roles: [Role.FieldPartner],
    });
    outsiderProjectManager = await registerUser(app, {
      roles: [Role.ProjectManager],
    });
    marketing = await registerUser(app, { roles: [Role.Marketing] });
    // `registerUser` logs the ambient session in as each new user.
    await projectManager.login();
  });

  // An Internship project whose MOU window is the four quarters of 2020, with
  // one engagement whose dates match it, so its GTL reports are exactly Q1-Q4
  // (plus the final report pinned to the end date). Created by the project
  // manager, who thereby becomes a member; the member field partner is added.
  const createInternship = async () => {
    await projectManager.login();
    const project = await createProject(app, {
      type: ProjectType.Internship,
      mouStart: '2020-01-01',
      mouEnd: '2020-12-31',
    });
    const engagement = await createInternshipEngagement(app, {
      project: project.id,
      startDateOverride: '2020-01-01',
      endDateOverride: '2020-12-31',
    });
    await createProjectMember(app, {
      project: project.id,
      user: memberFieldPartner.id,
      roles: [Role.FieldPartner],
    });
    const reports = await gtlReportsOf(engagement.id);
    const quarter = (start: string) =>
      reports.find((report) => report.start === start)!;
    return {
      project,
      engagement,
      q1: quarter('2020-01-01'),
      q2: quarter('2020-04-01'),
      q3: quarter('2020-07-01'),
      q4: quarter('2020-10-01'),
    };
  };

  const gtlReportsOf = async (engagement: ID) => {
    const result = await app.graphql.query(EngagementGtlReportsDoc, {
      id: engagement,
    });
    return result.engagement.gtlReports.items;
  };

  const createGoal = async (
    input: Partial<InputOf<typeof CreateGtlGoalDoc>> & { engagement: ID },
  ) => {
    const result = await app.graphql.mutate(CreateGtlGoalDoc, {
      input: { goal: 'Facilitate workshops', ...input },
    });
    return result.createGtlGoal.gtlGoal;
  };

  const reportProgress = async (
    input: InputOf<typeof ReportGtlGoalProgressDoc>,
  ) => {
    const result = await app.graphql.mutate(ReportGtlGoalProgressDoc, {
      input,
    });
    return result.reportGtlGoalProgress;
  };

  const summaryOf = async (engagement: ID) => {
    const result = await app.graphql.query(EngagementGoalSummaryDoc, {
      id: engagement,
    });
    return result.engagement.goalSummary;
  };

  const reportGoals = async (report: ID) => {
    const result = await app.graphql.query(ReportGoalsDoc, { id: report });
    const periodicReport = result.periodicReport;
    if (periodicReport.__typename !== 'GTLReport') {
      throw new Error('expected a GTL report');
    }
    return periodicReport;
  };

  describe('measurement shape', () => {
    it('a goal counted toward a target needs a target number and what is counted', async () => {
      const { engagement } = await createInternship();

      await app.graphql
        .mutate(CreateGtlGoalDoc, {
          input: {
            engagement: engagement.id,
            goal: 'Facilitate workshops',
            measurement: 'Number',
          },
        })
        .expectError(
          errors.input({
            field: 'targetNumber',
            message: 'A goal counted toward a target needs a target number',
          }),
        );

      await app.graphql
        .mutate(CreateGtlGoalDoc, {
          input: {
            engagement: engagement.id,
            goal: 'Facilitate workshops',
            measurement: 'Number',
            targetNumber: 10,
            targetDescription: '   ',
          },
        })
        .expectError(errors.input({ field: 'targetDescription' }));

      const goal = await createGoal({
        engagement: engagement.id,
        measurement: 'Number',
        targetNumber: 10,
        targetDescription: 'workshops facilitated',
      });
      expect(goal.measurement.value).toBe('Number');
      expect(goal.targetNumber.value).toBe(10);
      expect(goal.targetDescription.value).toBe('workshops facilitated');
      // Nothing reported yet.
      expect(goal.status.value).toBe('Planned');
      expect(goal.progressValue.value).toBeNull();
      expect(goal.percentComplete).toBe(0);
      expect(goal.scheduleStatus).toBeNull();
    });

    it('goals not counted toward a target carry no target number', async () => {
      const { engagement } = await createInternship();

      await app.graphql
        .mutate(CreateGtlGoalDoc, {
          input: {
            engagement: engagement.id,
            goal: 'Translate Mark',
            measurement: 'Percent',
            targetNumber: 10,
          },
        })
        .expectError(errors.input({ field: 'targetNumber' }));

      // Defaults to Done / Not done; a stray description is dropped.
      const goal = await createGoal({
        engagement: engagement.id,
        targetDescription: 'ignored',
      });
      expect(goal.measurement.value).toBe('Boolean');
      expect(goal.targetNumber.value).toBeNull();
      expect(goal.targetDescription.value).toBeNull();
    });

    it('an update is checked against the merged row', async () => {
      const { engagement } = await createInternship();
      const goal = await createGoal({ engagement: engagement.id });

      // Switching to Number without giving it a target.
      await app.graphql
        .mutate(UpdateGtlGoalDoc, {
          input: { id: goal.id, measurement: 'Number' },
        })
        .expectError(errors.input({ field: 'targetNumber' }));

      const updated = await app.graphql.mutate(UpdateGtlGoalDoc, {
        input: {
          id: goal.id,
          measurement: 'Number',
          targetNumber: 4,
          targetDescription: 'chapters drafted',
        },
      });
      expect(updated.updateGtlGoal.gtlGoal.measurement.value).toBe('Number');
      expect(updated.updateGtlGoal.gtlGoal.targetNumber.value).toBe(4);

      // Switching back without clearing the target is refused, since the
      // existing target would be carried along.
      await app.graphql
        .mutate(UpdateGtlGoalDoc, {
          input: { id: goal.id, measurement: 'Boolean' },
        })
        .expectError(errors.input({ field: 'targetNumber' }));
      const reverted = await app.graphql.mutate(UpdateGtlGoalDoc, {
        input: { id: goal.id, measurement: 'Boolean', targetNumber: null },
      });
      expect(reverted.updateGtlGoal.gtlGoal.targetNumber.value).toBeNull();
      expect(reverted.updateGtlGoal.gtlGoal.targetDescription.value).toBeNull();
    });
  });

  describe('quarterly progress', () => {
    it('a report says one thing about a goal: re-reporting revises the same entry', async () => {
      const { engagement, q1, q2 } = await createInternship();
      const goal = await createGoal({
        engagement: engagement.id,
        measurement: 'Number',
        targetNumber: 10,
        targetDescription: 'workshops facilitated',
      });

      const first = await reportProgress({
        goal: goal.id,
        report: q1.id,
        status: 'InProgress',
        progressValue: 3,
      });
      expect(first.progress.status.value).toBe('InProgress');
      expect(first.gtlGoal.status.value).toBe('InProgress');
      expect(first.gtlGoal.progressValue.value).toBe(3);
      expect(first.gtlGoal.percentComplete).toBe(30);

      const revised = await reportProgress({
        goal: goal.id,
        report: q1.id,
        status: 'AtRisk',
        progressValue: 5,
      });
      expect(revised.progress.id).toBe(first.progress.id);

      const q1Report = await reportGoals(q1.id);
      expect(q1Report.goalProgress).toHaveLength(1);
      expect(q1Report.goalProgress[0]!.id).toBe(first.progress.id);
      expect(q1Report.goalProgress[0]!.status.value).toBe('AtRisk');
      expect(q1Report.goalProgress[0]!.progressValue.value).toBe(5);
      expect(q1Report.goalProgress[0]!.goal.id).toBe(goal.id);

      // A different quarter is a second entry, and the newer one is what the
      // goal now says.
      const next = await reportProgress({
        goal: goal.id,
        report: q2.id,
        status: 'InProgress',
        progressValue: 8,
      });
      expect(next.progress.id).not.toBe(first.progress.id);
      expect(next.gtlGoal.status.value).toBe('InProgress');
      expect(next.gtlGoal.progressValue.value).toBe(8);
      expect(next.gtlGoal.percentComplete).toBe(80);
      expect((await reportGoals(q2.id)).goalProgress).toHaveLength(1);
      expect((await reportGoals(q1.id)).goalProgress).toHaveLength(1);
    });

    it("progressDate defaults to the report's period end and keeps an explicit date", async () => {
      const { engagement, q1, q2 } = await createInternship();
      const goal = await createGoal({ engagement: engagement.id });

      const defaulted = await reportProgress({
        goal: goal.id,
        report: q1.id,
        status: 'InProgress',
      });
      expect(defaulted.progress.progressDate.value).toBe(q1.end);
      expect(q1.end).toBe('2020-03-31');

      const explicit = await reportProgress({
        goal: goal.id,
        report: q2.id,
        status: 'InProgress',
        progressDate: CalendarDate.fromISO('2020-05-15').toISO(),
      });
      expect(explicit.progress.progressDate.value).toBe('2020-05-15');
    });

    it("the goal's status is the latest live entry on a live report, not a stored value", async () => {
      const { engagement, q1, q3 } = await createInternship();
      const goal = await createGoal({ engagement: engagement.id });

      await reportProgress({
        goal: goal.id,
        report: q1.id,
        status: 'InProgress',
      });
      const done = await reportProgress({
        goal: goal.id,
        report: q3.id,
        status: 'Done',
      });
      expect(done.gtlGoal.status.value).toBe('Done');
      expect(done.gtlGoal.percentComplete).toBe(100);

      // Shrinking the engagement removes the Q3 report. Nothing was written
      // back to the goal, so it falls back to the latest entry still standing.
      await app.graphql.mutate(UpdateInternshipEngagementDatesDoc, {
        id: engagement.id,
        endDateOverride: CalendarDate.fromISO('2020-06-30').toISO(),
      });
      const [after] = (await summaryOf(engagement.id)).goals;
      expect(after!.id).toBe(goal.id);
      expect(after!.status.value).toBe('InProgress');
      expect(after!.percentComplete).toBe(0);
    });

    it('refuses a report from another engagement', async () => {
      const own = await createInternship();
      const other = await createInternship();
      const goal = await createGoal({ engagement: own.engagement.id });

      await app.graphql
        .mutate(ReportGtlGoalProgressDoc, {
          input: { goal: goal.id, report: other.q1.id, status: 'InProgress' },
        })
        .expectError(errors.input({ field: 'report' }));

      // Same rule for where a goal was first proposed.
      await app.graphql
        .mutate(CreateGtlGoalDoc, {
          input: {
            engagement: own.engagement.id,
            goal: 'Mentor two translators',
            setInReport: other.q1.id,
          },
        })
        .expectError(errors.input({ field: 'setInReport' }));

      const proposed = await createGoal({
        engagement: own.engagement.id,
        goal: 'Mentor two translators',
        setInReport: own.q1.id,
      });
      const q1Report = await reportGoals(own.q1.id);
      expect(q1Report.goalsSet.map((set) => set.id)).toEqual([proposed.id]);
      expect((await reportGoals(own.q2.id)).goalsSet).toEqual([]);
    });
  });

  describe('rollup', () => {
    it('summarizes the plan from each goal’s own completion and schedule', async () => {
      const { engagement, q1 } = await createInternship();
      const yesterday = CalendarDate.local().minus({ days: 1 }).toISO();

      const counted = await createGoal({
        engagement: engagement.id,
        goal: 'A: counted',
        measurement: 'Number',
        targetNumber: 10,
        targetDescription: 'workshops facilitated',
        order: 1,
      });
      const percent = await createGoal({
        engagement: engagement.id,
        goal: 'B: percent, overdue',
        measurement: 'Percent',
        targetDate: yesterday,
        order: 2,
      });
      const boolean = await createGoal({
        engagement: engagement.id,
        goal: 'C: done early',
        // The target date is long past, but it was done in Q1 2020, before it.
        targetDate: CalendarDate.fromISO('2020-12-31').toISO(),
        order: 3,
      });

      await reportProgress({
        goal: counted.id,
        report: q1.id,
        status: 'InProgress',
        progressValue: 6,
      });
      await reportProgress({
        goal: percent.id,
        report: q1.id,
        status: 'AtRisk',
        progressValue: 40,
      });
      await reportProgress({
        goal: boolean.id,
        report: q1.id,
        status: 'Done',
      });

      const summary = await summaryOf(engagement.id);
      const byId = new Map(summary.goals.map((goal) => [goal.id, goal]));
      expect(byId.get(counted.id)!.percentComplete).toBe(60);
      expect(byId.get(counted.id)!.scheduleStatus).toBeNull();
      expect(byId.get(percent.id)!.percentComplete).toBe(40);
      expect(byId.get(percent.id)!.scheduleStatus).toBe('Behind');
      expect(byId.get(boolean.id)!.percentComplete).toBe(100);
      // The regression the POC had: judged by when it was done, not by today.
      expect(byId.get(boolean.id)!.scheduleStatus).toBe('Ahead');

      expect(summary).toMatchObject({
        total: 3,
        done: 1,
        active: 1,
        needsAttention: 1,
        behindSchedule: 1,
        percentComplete: 67,
      });
      // Plan order.
      expect(summary.goals.map((goal) => goal.id)).toEqual([
        counted.id,
        percent.id,
        boolean.id,
      ]);

      // Soft delete: the goal and its entry both drop out of every read.
      await app.graphql.mutate(DeleteGtlGoalDoc, { id: boolean.id });
      const afterDelete = await summaryOf(engagement.id);
      expect(afterDelete.total).toBe(2);
      expect(afterDelete.percentComplete).toBe(50);
      expect(
        (await reportGoals(q1.id)).goalProgress.map((entry) => entry.goal.id),
      ).toEqual([counted.id, percent.id]);
    });
  });

  describe('who may do what', () => {
    it('a field partner who is not on the project is refused', async () => {
      const { engagement, q1 } = await createInternship();
      const goal = await createGoal({ engagement: engagement.id });

      await outsiderFieldPartner.runAs(async () => {
        await app.graphql
          .mutate(CreateGtlGoalDoc, {
            input: { engagement: engagement.id, goal: 'Sneak one in' },
          })
          .expectError(
            errors.unauthorized({
              message: 'You do not have the permission to create gtl goals',
            }),
          );
        await app.graphql
          .mutate(ReportGtlGoalProgressDoc, {
            input: { goal: goal.id, report: q1.id, status: 'Done' },
          })
          .expectError(errors.unauthorized());
      });
    });

    // The read grant is member-conditioned and applied as SQL, so an outsider
    // gets an EMPTY plan rather than redacted goals. Paired with a positive
    // control on the same user so the empty list can't pass vacuously.
    it('hides the plan from a project manager who is not on the project', async () => {
      const { project, engagement, q1 } = await createInternship();
      const goal = await createGoal({ engagement: engagement.id });
      await reportProgress({
        goal: goal.id,
        report: q1.id,
        status: 'InProgress',
      });

      await outsiderProjectManager.runAs(async () => {
        const summary = await summaryOf(engagement.id);
        expect(summary.total).toBe(0);
        expect(summary.goals).toEqual([]);
        expect((await reportGoals(q1.id)).goalProgress).toEqual([]);
      });

      await createProjectMember(app, {
        project: project.id,
        user: outsiderProjectManager.id,
        roles: [Role.ProjectManager],
      });

      await outsiderProjectManager.runAs(async () => {
        const summary = await summaryOf(engagement.id);
        expect(summary.total).toBe(1);
        expect(summary.goals[0]!.goal.canRead).toBe(true);
        expect(summary.goals[0]!.goal.canEdit).toBe(true);
        expect((await reportGoals(q1.id)).goalProgress).toHaveLength(1);
      });
    });

    it('a member field partner works the plan; marketing only reads it', async () => {
      const { engagement, q1 } = await createInternship();

      const goal = await memberFieldPartner.runAs(async () => {
        const created = await createGoal({
          engagement: engagement.id,
          goal: 'Run a translation checking session',
        });
        expect(created.goal.canEdit).toBe(true);
        expect(created.canDelete).toBe(true);
        // Status is derived, so it is never directly editable.
        expect(created.status.canEdit).toBe(false);

        const updated = await app.graphql.mutate(UpdateGtlGoalDoc, {
          input: { id: created.id, goal: 'Run two checking sessions' },
        });
        expect(updated.updateGtlGoal.gtlGoal.goal.value).toBe(
          'Run two checking sessions',
        );

        const reported = await reportProgress({
          goal: created.id,
          report: q1.id,
          status: 'InProgress',
        });
        expect(reported.progress.status.canEdit).toBe(true);
        return created;
      });

      await marketing.runAs(async () => {
        const summary = await summaryOf(engagement.id);
        expect(summary.total).toBe(1);
        expect(summary.goals[0]!.goal.value).toBe('Run two checking sessions');
        expect(summary.goals[0]!.goal.canRead).toBe(true);
        expect(summary.goals[0]!.goal.canEdit).toBe(false);
        expect(summary.goals[0]!.canDelete).toBe(false);

        const [entry] = (await reportGoals(q1.id)).goalProgress;
        expect(entry!.status.value).toBe('InProgress');
        expect(entry!.status.canEdit).toBe(false);

        await app.graphql
          .mutate(UpdateGtlGoalDoc, {
            input: { id: goal.id, goal: 'Marketing rewrite' },
          })
          .expectError(
            errors.unauthorized({
              message: 'You do not have the permission to edit this gtl goal',
            }),
          );
        await app.graphql
          .mutate(ReportGtlGoalProgressDoc, {
            input: { goal: goal.id, report: q1.id, status: 'Done' },
          })
          .expectError(errors.unauthorized());
      });
    });
  });
});

const gtlGoalFields = graphql(`
  fragment gtlGoalFields on GtlGoal {
    id
    goal {
      value
      canRead
      canEdit
    }
    measurement {
      value
    }
    targetNumber {
      value
    }
    targetDescription {
      value
    }
    targetDate {
      value
    }
    progressValue {
      value
    }
    status {
      value
      canRead
      canEdit
    }
    percentComplete
    scheduleStatus
    order {
      value
    }
    canDelete
  }
`);

const gtlGoalProgressFields = graphql(`
  fragment gtlGoalProgressFields on GtlGoalProgress {
    id
    status {
      value
      canRead
      canEdit
    }
    progressValue {
      value
    }
    progressDate {
      value
    }
    goal {
      id
    }
  }
`);

const CreateGtlGoalDoc = graphql(
  `
    mutation CreateGtlGoal($input: CreateGtlGoal!) {
      createGtlGoal(input: $input) {
        gtlGoal {
          ...gtlGoalFields
        }
      }
    }
  `,
  [gtlGoalFields],
);

const UpdateGtlGoalDoc = graphql(
  `
    mutation UpdateGtlGoal($input: UpdateGtlGoal!) {
      updateGtlGoal(input: $input) {
        gtlGoal {
          ...gtlGoalFields
        }
      }
    }
  `,
  [gtlGoalFields],
);

const DeleteGtlGoalDoc = graphql(`
  mutation DeleteGtlGoal($id: ID!) {
    deleteGtlGoal(id: $id) {
      __typename
    }
  }
`);

const ReportGtlGoalProgressDoc = graphql(
  `
    mutation ReportGtlGoalProgress($input: ReportGtlGoalProgress!) {
      reportGtlGoalProgress(input: $input) {
        progress {
          ...gtlGoalProgressFields
        }
        gtlGoal {
          ...gtlGoalFields
        }
      }
    }
  `,
  [gtlGoalFields, gtlGoalProgressFields],
);

const EngagementGoalSummaryDoc = graphql(
  `
    query EngagementGoalSummary($id: ID!) {
      engagement: internshipEngagement(id: $id) {
        goalSummary {
          total
          done
          active
          needsAttention
          behindSchedule
          percentComplete
          goals {
            ...gtlGoalFields
          }
        }
      }
    }
  `,
  [gtlGoalFields],
);

const EngagementGtlReportsDoc = graphql(`
  query EngagementGtlReportsForGoals($id: ID!) {
    engagement: internshipEngagement(id: $id) {
      gtlReports {
        items {
          id
          start
          end
        }
      }
    }
  }
`);

const ReportGoalsDoc = graphql(
  `
    query ReportGoals($id: ID!) {
      periodicReport(id: $id) {
        __typename
        ... on GTLReport {
          goalsSet {
            ...gtlGoalFields
          }
          goalProgress {
            ...gtlGoalProgressFields
          }
        }
      }
    }
  `,
  [gtlGoalFields, gtlGoalProgressFields],
);

const UpdateInternshipEngagementDatesDoc = graphql(`
  mutation UpdateInternshipEngagementDatesForGoals(
    $id: ID!
    $endDateOverride: Date
  ) {
    updateInternshipEngagement(
      input: { id: $id, endDateOverride: $endDateOverride }
    ) {
      engagement {
        id
      }
    }
  }
`);
