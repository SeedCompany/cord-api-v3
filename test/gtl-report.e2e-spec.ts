import { beforeAll, describe, expect, it } from '@jest/globals';
import { CalendarDate, type ID, Role } from '~/common';
import { graphql } from '~/graphql';
import { ProjectType } from '../src/components/project/dto';
import {
  createInternshipEngagement,
  createProject,
  createProjectMember,
  createSession,
  createTestApp,
  registerUser,
  runInIsolatedSession,
  type TestApp,
} from './utility';

// GTL (Global Translation Leader) quarterly reports: the InternshipEngagement
// counterpart of the LanguageEngagement ProgressReport. One report per fiscal
// quarter of the engagement's date range, kept in step with that range.
describe('GTL Report e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [Role.ProjectManager, Role.FieldOperationsDirector],
    });
  });

  // An Internship project whose MOU window matches the engagement's dates, so
  // the engagement's start/end are exactly what we set.
  const createInternship = async (start: string, end: string) => {
    const project = await createProject(app, {
      type: ProjectType.Internship,
      mouStart: start,
      mouEnd: end,
    });
    const engagement = await createInternshipEngagement(app, {
      project: project.id,
      startDateOverride: start,
      endDateOverride: end,
    });
    return { project, engagement };
  };

  it('creates exactly one GTL report per fiscal quarter of the engagement', async () => {
    const { engagement } = await createInternship('2020-01-01', '2020-12-31');

    const result = await app.graphql.query(EngagementGtlReportsDoc, {
      id: engagement.id,
    });
    const { gtlReports } = result.engagement;

    const quarters = gtlReports.items.filter((r) => r.start !== r.end);
    expect(quarters.map((r) => [r.start, r.end])).toEqual([
      ['2020-01-01', '2020-03-31'],
      ['2020-04-01', '2020-06-30'],
      ['2020-07-01', '2020-09-30'],
      ['2020-10-01', '2020-12-31'],
    ]);
    // Plus the final report, pinned to the engagement's end date.
    const finalReport = gtlReports.items.find((r) => r.start === r.end);
    expect(finalReport?.start).toBe('2020-12-31');
    expect(gtlReports.total).toBe(5);

    for (const report of gtlReports.items) {
      expect(report.__typename).toBe('GTLReport');
      expect(report.type).toBe('GTL');
      expect(report.status.value).toBe('NotStarted');
      expect(report.parent.id).toBe(engagement.id);
    }

    // The by-date lookup lands on the quarter containing the date.
    const byDate = await app.graphql.query(EngagementGtlReportByDateDoc, {
      id: engagement.id,
      date: CalendarDate.fromISO('2020-05-15').toISO(),
    });
    expect(byDate.engagement.gtlReport.value?.start).toBe('2020-04-01');
    expect(byDate.engagement.gtlReport.value?.end).toBe('2020-06-30');
  });

  it('shrinking the date range removes the reports outside it and keeps the rest', async () => {
    const { engagement } = await createInternship('2020-01-01', '2020-12-31');

    const before = await app.graphql.query(EngagementGtlReportsDoc, {
      id: engagement.id,
    });
    const q1 = before.engagement.gtlReports.items.find(
      (r) => r.start === '2020-01-01',
    )!;
    const q3 = before.engagement.gtlReports.items.find(
      (r) => r.start === '2020-07-01',
    )!;
    expect(q1).toBeTruthy();
    expect(q3).toBeTruthy();

    await app.graphql.mutate(UpdateInternshipEngagementDatesDoc, {
      id: engagement.id,
      endDateOverride: CalendarDate.fromISO('2020-06-30').toISO(),
    });

    const after = await app.graphql.query(EngagementGtlReportsDoc, {
      id: engagement.id,
    });
    const remaining = after.engagement.gtlReports.items;
    const quarters = remaining.filter((r) => r.start !== r.end);
    expect(quarters.map((r) => r.start)).toEqual(['2020-01-01', '2020-04-01']);
    // Same rows survive — not re-created ones.
    expect(remaining.map((r) => r.id)).toContain(q1.id);
    expect(remaining.map((r) => r.id)).not.toContain(q3.id);
    // The final report follows the new end date.
    expect(remaining.find((r) => r.start === r.end)?.start).toBe('2020-06-30');
  });

  // The read policy for GTL reports is membership-based for a Project Manager,
  // and the repository applies it as SQL, so a non-member gets an EMPTY LIST
  // rather than a refusal or a page of redacted rows. Paired with a positive
  // control on the same user so the empty list can't pass vacuously.
  it('hides the reports from a user who is not a project member', async () => {
    const { project, engagement } = await createInternship(
      '2020-01-01',
      '2020-12-31',
    );
    // Registered in an isolated session: `registerUser` logs the ambient
    // session in as the new user, and we need to keep ours.
    const outsider = await runInIsolatedSession(
      app,
      async () => await registerUser(app, { roles: [Role.ProjectManager] }),
    );

    const asOutsider = await outsider.runAs(
      async () =>
        await app.graphql.query(EngagementGtlReportsDoc, {
          id: engagement.id,
        }),
    );
    expect(asOutsider.engagement.gtlReports.total).toBe(0);
    expect(asOutsider.engagement.gtlReports.items).toEqual([]);

    await createProjectMember(app, {
      project: project.id,
      user: outsider.id,
      roles: [Role.ProjectManager],
    });

    const asMember = await outsider.runAs(
      async () =>
        await app.graphql.query(EngagementGtlReportsDoc, {
          id: engagement.id,
        }),
    );
    expect(asMember.engagement.gtlReports.total).toBe(5);
    for (const report of asMember.engagement.gtlReports.items) {
      expect(report.status.canRead).toBe(true);
    }
  });

  it('reports the current and next GTL reports due', async () => {
    const today = CalendarDate.local();
    // Three quarters around today: the previous one has completed (current
    // due), this one is in progress (next due), and one more after it.
    const previousQuarter = today.minus({ quarters: 1 });
    const start = previousQuarter.startOf('quarter');
    const end = today.plus({ quarters: 1 }).endOf('quarter');
    const { engagement } = await createInternship(start.toISO(), end.toISO());

    const result = await app.graphql.query(EngagementGtlDueDoc, {
      id: engagement.id,
    });
    const { currentGtlReportDue, nextGtlReportDue, latestGtlReportSubmitted } =
      result.engagement;

    expect(currentGtlReportDue.value?.start).toBe(
      previousQuarter.startOf('quarter').toISO(),
    );
    expect(currentGtlReportDue.value?.end).toBe(
      previousQuarter.endOf('quarter').toISO(),
    );

    // "Next" is the first report whose end is still ahead of today — this
    // quarter, except on its very last day.
    const inProgressQuarter =
      +today.endOf('quarter') > +today ? today : today.plus({ quarters: 1 });
    expect(nextGtlReportDue.value?.start).toBe(
      inProgressQuarter.startOf('quarter').toISO(),
    );
    expect(nextGtlReportDue.value?.end).toBe(
      inProgressQuarter.endOf('quarter').toISO(),
    );

    // Nothing has been uploaded yet.
    expect(latestGtlReportSubmitted.value).toBeNull();
  });

  it('programProgress is the elapsed share of the engagement, clamped to 0-100', async () => {
    const past = await createInternship('2020-01-01', '2020-12-31');
    const future = await createInternship('2090-01-01', '2090-12-31');
    const today = CalendarDate.local();
    const ongoing = await createInternship(
      today.minus({ days: 100 }).toISO(),
      today.plus({ days: 100 }).toISO(),
    );

    const progressOf = async (id: ID) => {
      const result = await app.graphql.query(EngagementGtlDueDoc, { id });
      return result.engagement.programProgress;
    };

    expect(await progressOf(past.engagement.id)).toBe(100);
    expect(await progressOf(future.engagement.id)).toBe(0);
    const midway = await progressOf(ongoing.engagement.id);
    expect(midway).toBeGreaterThan(40);
    expect(midway).toBeLessThan(60);
  });
});

const gtlReportFields = graphql(`
  fragment gtlReportFields on GTLReport {
    __typename
    id
    type
    start
    end
    status {
      value
      canRead
    }
    parent {
      id
    }
  }
`);

const EngagementGtlReportsDoc = graphql(
  `
    query EngagementGtlReports($id: ID!) {
      engagement: internshipEngagement(id: $id) {
        gtlReports {
          total
          items {
            ...gtlReportFields
          }
        }
      }
    }
  `,
  [gtlReportFields],
);

const EngagementGtlReportByDateDoc = graphql(
  `
    query EngagementGtlReportByDate($id: ID!, $date: Date!) {
      engagement: internshipEngagement(id: $id) {
        gtlReport(date: $date) {
          value {
            ...gtlReportFields
          }
        }
      }
    }
  `,
  [gtlReportFields],
);

const EngagementGtlDueDoc = graphql(
  `
    query EngagementGtlDue($id: ID!) {
      engagement: internshipEngagement(id: $id) {
        programProgress
        currentGtlReportDue {
          value {
            ...gtlReportFields
          }
        }
        nextGtlReportDue {
          value {
            ...gtlReportFields
          }
        }
        latestGtlReportSubmitted {
          value {
            id
          }
        }
      }
    }
  `,
  [gtlReportFields],
);

const UpdateInternshipEngagementDatesDoc = graphql(`
  mutation UpdateInternshipEngagementDates($id: ID!, $endDateOverride: Date) {
    updateInternshipEngagement(
      input: { id: $id, endDateOverride: $endDateOverride }
    ) {
      engagement {
        id
      }
    }
  }
`);
