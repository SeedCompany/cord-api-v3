import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { CalendarDate, type ID } from '~/common';
import { graphql } from '~/graphql';
import {
  createLanguage,
  createProject,
  createSession,
  createTestApp,
  fragments,
  registerUser,
  requestFileUpload,
  runAsAdmin,
  type TestApp,
  uploadFileContents,
} from './utility';

describe('PeriodicReport narrativeFile e2e', () => {
  let app: TestApp;
  let project: fragments.project;
  let reportId: ID<'ProgressReport'>;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: ['ProjectManager'] });

    project = await createProject(app, {
      mouStart: CalendarDate.local(2023, 1, 1).toISO(),
      mouEnd: CalendarDate.local(2024, 1, 1).toISO(),
    });
  });

  beforeEach(async () => {
    const language = await runAsAdmin(app, createLanguage);
    const mouStart = CalendarDate.local(2023, 1, 1).toISO();
    const mouEnd = CalendarDate.local(2024, 1, 1).toISO();

    const { createEng } = await app.graphql.mutate(
      CreateLanguageEngagementDoc,
      {
        input: {
          project: project.id,
          language: language.id,
          startDateOverride: mouStart,
          endDateOverride: mouEnd,
        },
      },
    );
    reportId = createEng.engagement.progressReports.items[0]!.id;
  });

  it('narrativeFile and narrativeReceivedDate are null by default', async () => {
    const report = await getReport(app, reportId);
    expect(report.narrativeFile.value).toBeNull();
    expect(report.narrativeReceivedDate.value).toBeNull();
    expect(report.reportFile.value).toBeNull();
    expect(report.receivedDate.value).toBeNull();
  });

  it('uploadPeriodicReportNarrativeFile sets narrativeFile and leaves reportFile untouched', async () => {
    const upload = await requestFileUpload(app);
    await uploadFileContents(app, upload.url, {
      mimeType: 'application/pdf',
      name: 'narrative.pdf',
    });

    const { report } = await app.graphql.mutate(
      UploadPeriodicReportNarrativeFileDoc,
      {
        input: {
          report: reportId,
          file: { upload: upload.id, name: 'narrative.pdf' },
        },
      },
    );

    if (report.__typename !== 'ProgressReport') throw new Error();
    expect(report.narrativeFile.value?.id).toBeTruthy();
    expect(report.narrativeFile.value?.name).toBe('narrative.pdf');
    expect(report.reportFile.value).toBeNull();
  });

  it('uploadPeriodicReport sets reportFile and leaves narrativeFile untouched', async () => {
    const upload = await requestFileUpload(app);
    await uploadFileContents(app, upload.url, {
      mimeType: 'application/pdf',
      name: 'pnp.pdf',
    });

    const { report } = await app.graphql.mutate(UploadPeriodicReportDoc, {
      input: {
        report: reportId,
        file: { upload: upload.id, name: 'pnp.pdf' },
      },
    });

    if (report.__typename !== 'ProgressReport') throw new Error();
    expect(report.reportFile.value?.id).toBeTruthy();
    expect(report.reportFile.value?.name).toBe('pnp.pdf');
    expect(report.narrativeFile.value).toBeNull();
  });

  it('both files can coexist on the same report', async () => {
    const pnp = await requestFileUpload(app);
    await uploadFileContents(app, pnp.url, {
      mimeType: 'application/pdf',
      name: 'pnp.pdf',
    });
    await app.graphql.mutate(UploadPeriodicReportDoc, {
      input: {
        report: reportId,
        file: { upload: pnp.id, name: 'pnp.pdf' },
      },
    });

    const narrative = await requestFileUpload(app);
    await uploadFileContents(app, narrative.url, {
      mimeType: 'application/pdf',
      name: 'narrative.pdf',
    });
    await app.graphql.mutate(UploadPeriodicReportNarrativeFileDoc, {
      input: {
        report: reportId,
        file: { upload: narrative.id, name: 'narrative.pdf' },
      },
    });

    const report = await getReport(app, reportId);
    expect(report.reportFile.value?.name).toBe('pnp.pdf');
    expect(report.narrativeFile.value?.name).toBe('narrative.pdf');
    expect(report.reportFile.value?.id).not.toBe(
      report.narrativeFile.value?.id,
    );
  });

  it('updatePeriodicReport sets receivedDate and narrativeReceivedDate independently', async () => {
    const receivedDate = CalendarDate.local(2023, 6, 1).toISO();
    const narrativeReceivedDate = CalendarDate.local(2023, 7, 15).toISO();

    await app.graphql.mutate(UpdatePeriodicReportDoc, {
      input: { id: reportId, receivedDate },
    });
    let report = await getReport(app, reportId);
    expect(report.receivedDate.value).toBe(receivedDate);
    expect(report.narrativeReceivedDate.value).toBeNull();

    await app.graphql.mutate(UpdatePeriodicReportDoc, {
      input: { id: reportId, narrativeReceivedDate },
    });
    report = await getReport(app, reportId);
    expect(report.receivedDate.value).toBe(receivedDate);
    expect(report.narrativeReceivedDate.value).toBe(narrativeReceivedDate);
  });

  it('updatePeriodicReport accepts narrativeFile inline', async () => {
    const upload = await requestFileUpload(app);
    await uploadFileContents(app, upload.url, {
      mimeType: 'application/pdf',
      name: 'narrative-inline.pdf',
    });

    await app.graphql.mutate(UpdatePeriodicReportDoc, {
      input: {
        id: reportId,
        narrativeFile: { upload: upload.id, name: 'narrative-inline.pdf' },
      },
    });

    const report = await getReport(app, reportId);
    expect(report.narrativeFile.value?.name).toBe('narrative-inline.pdf');
  });
});

async function getReport(app: TestApp, id: ID<'ProgressReport'>) {
  const { report } = await app.graphql.query(PeriodicReportFilesDoc, { id });
  if (report.__typename !== 'ProgressReport') throw new Error();
  return report;
}

const PeriodicReportFilesDoc = graphql(`
  query PeriodicReportFiles($id: ID!) {
    report: periodicReport(id: $id) {
      __typename
      ... on ProgressReport {
        receivedDate {
          value
        }
        narrativeReceivedDate {
          value
        }
        reportFile {
          value {
            id
            name
            url
          }
        }
        narrativeFile {
          value {
            id
            name
            url
          }
        }
      }
    }
  }
`);

const CreateLanguageEngagementDoc = graphql(
  `
    mutation CreateLanguageEngagement($input: CreateLanguageEngagement!) {
      createEng: createLanguageEngagement(input: $input) {
        engagement {
          ...languageEngagement
          progressReports(input: { count: 1 }) {
            items {
              id
            }
          }
        }
      }
    }
  `,
  [fragments.languageEngagement],
);

const UploadPeriodicReportDoc = graphql(`
  mutation UploadPeriodicReport($input: UploadPeriodicReportFile!) {
    report: uploadPeriodicReport(input: $input) {
      __typename
      ... on ProgressReport {
        reportFile {
          value {
            id
            name
          }
        }
        narrativeFile {
          value {
            id
          }
        }
      }
    }
  }
`);

const UploadPeriodicReportNarrativeFileDoc = graphql(`
  mutation UploadPeriodicReportNarrativeFile(
    $input: UploadPeriodicReportFile!
  ) {
    report: uploadPeriodicReportNarrativeFile(input: $input) {
      __typename
      ... on ProgressReport {
        reportFile {
          value {
            id
          }
        }
        narrativeFile {
          value {
            id
            name
          }
        }
      }
    }
  }
`);

const UpdatePeriodicReportDoc = graphql(`
  mutation UpdatePeriodicReport($input: UpdatePeriodicReport!) {
    updatePeriodicReport(input: $input) {
      __typename
    }
  }
`);
