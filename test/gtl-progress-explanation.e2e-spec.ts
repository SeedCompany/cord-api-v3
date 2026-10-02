import { beforeAll, describe, expect, it } from '@jest/globals';
import { type ID, Role } from '~/common';
import { graphql } from '~/graphql';
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

const cannotEdit = errors.unauthorized({
  message:
    'You do not have the permission to edit this gtl progress explanation',
});

// The Explanation of Progress section of a GTL report (#3969): the Field
// Project Manager's confidential read on how the internship is tracking.
// Field Operations (member Project Managers, Regional Directors and Field Ops
// Directors) read and write it; Marketing sees the status alone; the Field
// Partner who wrote the report gets nothing at all — not even a redacted
// shell, and never the text.
describe('GTL Progress Explanation e2e', () => {
  let app: TestApp;
  let projectManager: TestUser;
  /** Added to every project created here. */
  let memberFieldPartner: TestUser;
  /** A Project Manager who is NOT on the project. */
  let outsiderProjectManager: TestUser;
  /** Never on a project; directors act globally. */
  let fieldOpsDirector: TestUser;
  let marketing: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    projectManager = await registerUser(app, { roles: [Role.ProjectManager] });
    memberFieldPartner = await registerUser(app, {
      roles: [Role.FieldPartner],
    });
    outsiderProjectManager = await registerUser(app, {
      roles: [Role.ProjectManager],
    });
    fieldOpsDirector = await registerUser(app, {
      roles: [Role.FieldOperationsDirector],
    });
    marketing = await registerUser(app, { roles: [Role.Marketing] });
    await projectManager.login();
  });

  // An Internship project whose MOU window is 2020, with one engagement whose
  // dates match it. Created by the project manager, who thereby becomes a
  // member; the member field partner is added. Returns the Q1 report's id.
  const createInternshipReport = async (): Promise<ID> => {
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
    const result = await app.graphql.query(EngagementGtlReportsDoc, {
      id: engagement.id,
    });
    const q1 = result.engagement.gtlReports.items.find(
      (report) => report.start === '2020-01-01',
    );
    if (!q1) throw new Error('expected a Q1 2020 GTL report');
    return q1.id;
  };

  /** The raw query result too, so a test can prove a text appears nowhere in it. */
  const explanationOf = async (report: ID) => {
    const result = await app.graphql.query(ReportExplanationDoc, {
      id: report,
    });
    const periodicReport = result.periodicReport;
    if (periodicReport.__typename !== 'GTLReport') {
      throw new Error('expected a GTL report');
    }
    return { explanation: periodicReport.progressExplanation, raw: result };
  };

  it('a member project manager explains the quarter and revises the explanation', async () => {
    const reportId = await createInternshipReport();

    const { explanation: nothingYet } = await explanationOf(reportId);
    expect(nothingYet).not.toBeNull();
    expect(nothingYet!.status.value).toBeNull();
    expect(nothingYet!.status.canEdit).toBe(true);
    expect(nothingYet!.context.value).toBeNull();

    const result = await app.graphql.mutate(ExplainDoc, {
      input: {
        report: reportId,
        status: 'NeedsAChangeToPlan',
        context: doc('The practicum site closed for the quarter'),
      },
    });
    const written = result.explainGtlProgress;
    expect(written.id).toBe(reportId);
    expect(written.progressExplanation!.status.value).toBe(
      'NeedsAChangeToPlan',
    );
    expect(textOf(written.progressExplanation!.context.value)).toBe(
      'The practicum site closed for the quarter',
    );

    const { explanation } = await explanationOf(reportId);
    expect(explanation!.status.value).toBe('NeedsAChangeToPlan');
    expect(explanation!.status.canRead).toBe(true);
    expect(explanation!.status.canEdit).toBe(true);
    expect(textOf(explanation!.context.value)).toBe(
      'The practicum site closed for the quarter',
    );
    expect(explanation!.context.canEdit).toBe(true);

    // One explanation per report: a second write revises it in place.
    await app.graphql.mutate(ExplainDoc, {
      input: { report: reportId, status: 'OnTrack' },
    });
    const { explanation: revised } = await explanationOf(reportId);
    expect(revised!.status.value).toBe('OnTrack');
    expect(revised!.context.value).toBeNull();
  });

  it('anything other than On Track needs the why', async () => {
    const reportId = await createInternshipReport();

    for (const status of [
      'AheadOfSchedule',
      'DelayedYetExpectedToCompleteOnTime',
      'NeedsAChangeToPlan',
    ] as const) {
      await app.graphql
        .mutate(ExplainDoc, { input: { report: reportId, status } })
        .expectError(errors.input({ field: 'context' }));
    }
    await app.graphql.mutate(ExplainDoc, {
      input: { report: reportId, status: 'OnTrack' },
    });
  });

  describe('who may do what', () => {
    const secret = 'Confidential: the leader is struggling with the mentor';

    const explained = async () => {
      const reportId = await createInternshipReport();
      await app.graphql.mutate(ExplainDoc, {
        input: {
          report: reportId,
          status: 'DelayedYetExpectedToCompleteOnTime',
          context: doc(secret),
        },
      });
      return reportId;
    };

    it('the field partner gets nothing at all, and the text never reaches them', async () => {
      const reportId = await explained();

      await memberFieldPartner.login();
      const { explanation, raw } = await explanationOf(reportId);
      expect(explanation).toBeNull();
      expect(JSON.stringify(raw)).not.toContain(secret);

      await app.graphql
        .mutate(ExplainDoc, {
          input: {
            report: reportId,
            status: 'OnTrack',
            context: doc('All fine, honestly'),
          },
        })
        .expectError(cannotEdit);
    });

    it('marketing sees the status but never the explanation', async () => {
      const reportId = await explained();

      await marketing.login();
      const { explanation, raw } = await explanationOf(reportId);
      expect(explanation!.status.canRead).toBe(true);
      expect(explanation!.status.value).toBe(
        'DelayedYetExpectedToCompleteOnTime',
      );
      expect(explanation!.status.canEdit).toBe(false);
      expect(explanation!.context.canRead).toBe(false);
      expect(explanation!.context.value).toBeNull();
      expect(JSON.stringify(raw)).not.toContain(secret);

      await app.graphql
        .mutate(ExplainDoc, {
          input: { report: reportId, status: 'OnTrack' },
        })
        .expectError(cannotEdit);
    });

    it('a field operations director acts without being on the project', async () => {
      const reportId = await explained();

      await fieldOpsDirector.login();
      const result = await app.graphql.mutate(ExplainDoc, {
        input: {
          report: reportId,
          status: 'AheadOfSchedule',
          context: doc('Finished the practicum a quarter early'),
        },
      });
      expect(result.explainGtlProgress.progressExplanation!.status.value).toBe(
        'AheadOfSchedule',
      );

      const { explanation } = await explanationOf(reportId);
      expect(explanation!.status.value).toBe('AheadOfSchedule');
      expect(explanation!.status.canEdit).toBe(true);
      expect(textOf(explanation!.context.value)).toBe(
        'Finished the practicum a quarter early',
      );
    });

    it('a project manager who is not on the project is refused both ways', async () => {
      const reportId = await explained();

      await outsiderProjectManager.login();
      const { explanation, raw } = await explanationOf(reportId);
      expect(explanation).toBeNull();
      expect(JSON.stringify(raw)).not.toContain(secret);

      await app.graphql
        .mutate(ExplainDoc, {
          input: { report: reportId, status: 'OnTrack' },
        })
        .expectError(cannotEdit);
    });
  });
});

const explanationFields = graphql(`
  fragment gtlProgressExplanationFields on GtlProgressExplanation {
    status {
      value
      canRead
      canEdit
    }
    context {
      value
      canRead
      canEdit
    }
  }
`);

const ExplainDoc = graphql(
  `
    mutation ExplainGtlProgress($input: ExplainGtlProgress!) {
      explainGtlProgress(input: $input) {
        id
        progressExplanation {
          ...gtlProgressExplanationFields
        }
      }
    }
  `,
  [explanationFields],
);

const ReportExplanationDoc = graphql(
  `
    query ReportProgressExplanation($id: ID!) {
      periodicReport(id: $id) {
        __typename
        ... on GTLReport {
          progressExplanation {
            ...gtlProgressExplanationFields
          }
        }
      }
    }
  `,
  [explanationFields],
);

const EngagementGtlReportsDoc = graphql(`
  query EngagementGtlReportsForExplanation($id: ID!) {
    engagement: internshipEngagement(id: $id) {
      gtlReports {
        items {
          id
          start
        }
      }
    }
  }
`);
