import { beforeAll, describe, expect, it } from '@jest/globals';
import { CalendarDate, Role } from '~/common';
import { graphql } from '~/graphql';
import {
  createLanguage,
  createLanguageEngagement,
  createProject,
  createSession,
  createTestApp,
  registerUser,
  requestFileUpload,
  runAsAdmin,
  type TestApp,
  uploadFileContents,
} from './utility';
import { createDirectProduct } from './utility/create-product-direct';
import { updateProject } from './utility/update-project';

describe('Periodic Report e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [Role.ProjectManager, Role.FieldOperationsDirector],
    });
  });

  it('syncs narrative reports quarterly when project dates change', async () => {
    const project = await createProject(app);
    // The sync runs on update, not create.
    await updateProject(app, {
      id: project.id,
      mouStart: CalendarDate.fromISO('2020-01-01').toISO(),
      mouEnd: CalendarDate.fromISO('2020-12-31').toISO(),
    });

    const result = await app.graphql.query(ProjectReportsDoc, {
      id: project.id,
    });
    const { narrativeReports } = result.project;
    // 4 quarters + the final report (start = end = quarter end)
    expect(narrativeReports.total).toBe(5);
    const quarters = narrativeReports.items.filter((r) => r.start !== r.end);
    expect(quarters).toHaveLength(4);
    expect(quarters.map((r) => r.start)).toEqual([
      '2020-01-01',
      '2020-04-01',
      '2020-07-01',
      '2020-10-01',
    ]);
    const finalReport = narrativeReports.items.find((r) => r.start === r.end);
    expect(finalReport?.start).toBe('2020-12-31');
  });

  it('syncs financial reports by the report period', async () => {
    const project = await createProject(app);
    await updateProject(app, {
      id: project.id,
      mouStart: CalendarDate.fromISO('2020-01-01').toISO(),
      mouEnd: CalendarDate.fromISO('2020-06-30').toISO(),
      financialReportPeriod: 'Monthly',
    });

    const result = await app.graphql.query(ProjectReportsDoc, {
      id: project.id,
    });
    const { financialReports } = result.project;
    const monthly = financialReports.items.filter((r) => r.start !== r.end);
    expect(monthly).toHaveLength(6);

    // Switching the period replaces the reports.
    await updateProject(app, {
      id: project.id,
      financialReportPeriod: 'Quarterly',
    });
    const after = await app.graphql.query(ProjectReportsDoc, {
      id: project.id,
    });
    const quarterly = after.project.financialReports.items.filter(
      (r) => r.start !== r.end,
    );
    expect(quarterly).toHaveLength(2);
  });

  it('creates progress reports for each engagement quarter', async () => {
    const project = await createProject(app, {
      mouStart: CalendarDate.fromISO('2020-01-01').toISO(),
      mouEnd: CalendarDate.fromISO('2020-12-31').toISO(),
    });
    const language = await runAsAdmin(app, createLanguage);
    const engagement = await createLanguageEngagement(app, {
      project: project.id,
      language: language.id,
      startDateOverride: CalendarDate.fromISO('2020-01-01').toISO(),
      endDateOverride: CalendarDate.fromISO('2020-06-30').toISO(),
    });

    const result = await app.graphql.query(EngagementReportsDoc, {
      id: engagement.id,
    });
    const { progressReports } = result.engagement;
    const quarters = progressReports.items.filter((r) => r.start !== r.end);
    expect(quarters).toHaveLength(2);
    expect(quarters.map((r) => r.start)).toEqual(['2020-01-01', '2020-04-01']);
    for (const report of progressReports.items) {
      expect(report.type).toBe('Progress');
      expect(report.status.value).toBe('NotStarted');
    }
  });

  it('shrinking engagement dates removes unstarted reports', async () => {
    const project = await createProject(app, {
      mouStart: CalendarDate.fromISO('2020-01-01').toISO(),
      mouEnd: CalendarDate.fromISO('2020-12-31').toISO(),
    });
    const language = await runAsAdmin(app, createLanguage);
    const engagement = await createLanguageEngagement(app, {
      project: project.id,
      language: language.id,
      startDateOverride: CalendarDate.fromISO('2020-01-01').toISO(),
      endDateOverride: CalendarDate.fromISO('2020-12-31').toISO(),
    });

    await app.graphql.mutate(UpdateEngagementDatesDoc, {
      id: engagement.id,
      endDateOverride: CalendarDate.fromISO('2020-06-30').toISO(),
    });

    const result = await app.graphql.query(EngagementReportsDoc, {
      id: engagement.id,
    });
    const quarters = result.engagement.progressReports.items.filter(
      (r) => r.start !== r.end,
    );
    expect(quarters).toHaveLength(2);
  });

  it('records product progress against a report', async () => {
    const project = await createProject(app, {
      mouStart: CalendarDate.fromISO('2020-01-01').toISO(),
      mouEnd: CalendarDate.fromISO('2020-12-31').toISO(),
    });
    const language = await runAsAdmin(app, createLanguage);
    const engagement = await createLanguageEngagement(app, {
      project: project.id,
      language: language.id,
      startDateOverride: CalendarDate.fromISO('2020-01-01').toISO(),
      endDateOverride: CalendarDate.fromISO('2020-12-31').toISO(),
    });
    const product = await createDirectProduct(app, {
      engagement: engagement.id,
      steps: ['ExegesisAndFirstDraft', 'TeamCheck'],
      progressStepMeasurement: 'Percent',
    });
    const reports = await app.graphql.query(EngagementReportsDoc, {
      id: engagement.id,
    });
    const report = reports.engagement.progressReports.items.find(
      (r) => r.start !== r.end,
    )!;

    const updated = await app.graphql.mutate(UpdateProductProgressDoc, {
      input: {
        product: product.id,
        report: report.id,
        steps: [{ step: 'ExegesisAndFirstDraft', completed: 25 }],
      },
    });
    const { steps } = updated.updateProductProgress;
    // Ordered by the product's declared steps; unreported steps are
    // placeholders with a null completed value.
    expect(steps.map((s) => s.step)).toEqual([
      'ExegesisAndFirstDraft',
      'TeamCheck',
    ]);
    expect(steps[0]!.completed.value).toBe(25);
    expect(steps[1]!.completed.value).toBeNull();
  });

  // Data-loss regression guard. When a report's interval falls out of the MOU
  // window the sync hard-deletes it — UNLESS a file has been uploaded against
  // it. A report someone uploaded must never silently vanish because the dates
  // shifted. This is a cross-engine parity test: neo4j already preserves
  // file-bearing reports; the PG repo must match (it previously did not).
  it('preserves a report with an uploaded file when its interval falls out of range', async () => {
    const project = await createProject(app);
    await updateProject(app, {
      id: project.id,
      mouStart: CalendarDate.fromISO('2020-01-01').toISO(),
      mouEnd: CalendarDate.fromISO('2020-12-31').toISO(),
    });

    const before = await app.graphql.query(ProjectReportsDoc, {
      id: project.id,
    });
    const q3 = before.project.narrativeReports.items.find(
      (r) => r.start === '2020-07-01',
    )!;
    const q4 = before.project.narrativeReports.items.find(
      (r) => r.start === '2020-10-01',
    )!;
    expect(q3).toBeTruthy();
    expect(q4).toBeTruthy();

    // Attach a real file version to the Q4 report.
    const { id: uploadId, url } = await requestFileUpload(app);
    await uploadFileContents(app, url);
    await app.graphql.mutate(UploadPeriodicReportDoc, {
      input: {
        report: q4.id,
        file: { upload: uploadId, name: 'q4-report.pdf' },
      },
    });

    // Shrink the MOU so both Q3 and Q4 now fall out of range.
    await updateProject(app, {
      id: project.id,
      mouEnd: CalendarDate.fromISO('2020-06-30').toISO(),
    });

    const after = await app.graphql.query(ProjectReportsDoc, {
      id: project.id,
    });
    const remaining = after.project.narrativeReports.items.map((r) => r.id);

    // Q3 had no file -> the sync hard-deletes it. Proves the delete path
    // actually executed (otherwise the Q4 assertion would pass vacuously).
    expect(remaining).not.toContain(q3.id);
    // Q4 had an uploaded file -> it must survive the date shift.
    expect(remaining).toContain(q4.id);
  });

  // Narrative twin of the guard above: a NARRATIVE-only upload must also
  // protect the report from the date-shift hard delete, and the
  // narrativeReceivedDate round-trip proves the update + hydrate paths.
  it('preserves a report with an uploaded narrative file when its interval falls out of range', async () => {
    const project = await createProject(app);
    await updateProject(app, {
      id: project.id,
      mouStart: CalendarDate.fromISO('2020-01-01').toISO(),
      mouEnd: CalendarDate.fromISO('2020-12-31').toISO(),
    });

    const before = await app.graphql.query(ProjectReportsDoc, {
      id: project.id,
    });
    const q3 = before.project.narrativeReports.items.find(
      (r) => r.start === '2020-07-01',
    )!;
    const q4 = before.project.narrativeReports.items.find(
      (r) => r.start === '2020-10-01',
    )!;

    // Attach a narrative file version + received date to Q4 only.
    const { id: uploadId, url } = await requestFileUpload(app);
    await uploadFileContents(app, url);
    const updated = await app.graphql.mutate(UpdatePeriodicReportDoc, {
      input: {
        id: q4.id,
        narrativeFile: { upload: uploadId, name: 'q4-narrative.pdf' },
        narrativeReceivedDate: CalendarDate.fromISO('2020-11-15').toISO(),
      },
    });
    expect(updated.updatePeriodicReport.narrativeReceivedDate.value).toBe(
      '2020-11-15',
    );

    // Shrink the MOU so both Q3 and Q4 fall out of range.
    await updateProject(app, {
      id: project.id,
      mouEnd: CalendarDate.fromISO('2020-06-30').toISO(),
    });

    const after = await app.graphql.query(ProjectReportsDoc, {
      id: project.id,
    });
    const remaining = after.project.narrativeReports.items.map((r) => r.id);
    expect(remaining).not.toContain(q3.id);
    // Narrative-only upload must protect the report, same as a report file.
    expect(remaining).toContain(q4.id);
  });

  it('updates receivedDate and skippedReason', async () => {
    const project = await createProject(app);
    await updateProject(app, {
      id: project.id,
      mouStart: CalendarDate.fromISO('2021-01-01').toISO(),
      mouEnd: CalendarDate.fromISO('2021-03-31').toISO(),
    });
    const reports = await app.graphql.query(ProjectReportsDoc, {
      id: project.id,
    });
    const report = reports.project.narrativeReports.items[0]!;

    const updated = await app.graphql.mutate(UpdatePeriodicReportDoc, {
      input: {
        id: report.id,
        receivedDate: CalendarDate.fromISO('2021-04-15').toISO(),
        skippedReason: 'COVID',
      },
    });
    expect(updated.updatePeriodicReport.receivedDate.value).toBe('2021-04-15');
    expect(updated.updatePeriodicReport.skippedReason.value).toBe('COVID');

    // Mono asserts the audit-log `history` here (ResourceMutatedHook +
    // resource_mutations) — restore with the audit-log wave, which brings the
    // schema field this queries.
  });
});

const UploadPeriodicReportDoc = graphql(`
  mutation UploadPeriodicReportForGuard($input: UploadPeriodicReportFile!) {
    uploadPeriodicReport(input: $input) {
      id
    }
  }
`);

const reportFields = graphql(`
  fragment reportFields on PeriodicReport {
    id
    type
    start
    end
    receivedDate {
      value
    }
    skippedReason {
      value
    }
  }
`);

const ProjectReportsDoc = graphql(
  `
    query ProjectReports($id: ID!) {
      project(id: $id) {
        narrativeReports {
          total
          items {
            ...reportFields
          }
        }
        financialReports {
          total
          items {
            ...reportFields
          }
        }
      }
    }
  `,
  [reportFields],
);

const EngagementReportsDoc = graphql(
  `
    query EngagementReports($id: ID!) {
      engagement: languageEngagement(id: $id) {
        progressReports {
          total
          items {
            ...reportFields
            ... on ProgressReport {
              status {
                value
              }
            }
          }
        }
      }
    }
  `,
  [reportFields],
);

const UpdatePeriodicReportDoc = graphql(`
  mutation UpdatePeriodicReport($input: UpdatePeriodicReport!) {
    updatePeriodicReport(input: $input) {
      id
      receivedDate {
        value
      }
      narrativeReceivedDate {
        value
      }
      skippedReason {
        value
      }
    }
  }
`);

const UpdateProductProgressDoc = graphql(`
  mutation UpdateProductProgress($input: UpdateProductProgress!) {
    updateProductProgress(input: $input) {
      steps {
        step
        completed {
          value
        }
      }
    }
  }
`);

const UpdateEngagementDatesDoc = graphql(`
  mutation UpdateEngagementDates($id: ID!, $endDateOverride: Date) {
    updateLanguageEngagement(
      input: { id: $id, endDateOverride: $endDateOverride }
    ) {
      engagement {
        id
      }
    }
  }
`);
