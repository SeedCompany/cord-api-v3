import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { CalendarDate, type ID, isIdLike } from '~/common';
import { graphql } from '~/graphql';
import {
  createLanguageEngagement,
  createProject,
  createSession,
  createTestApp,
  errors,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';
import { createLanguage } from './utility/create-language';

const REV79_PROJECT_ID = faker.string.uuid();
const REV79_COMMUNITY_ID = faker.string.uuid();
const TARGET_PERIOD = { year: 2024, quarter: 2 };

describe('Rev79 e2e', () => {
  let app: TestApp;
  let projectId: ID<'Project'>;
  let engagementId: ID<'LanguageEngagement'>;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: ['ProjectManager'] });

    const project = await createProject(app, {
      rev79ProjectId: REV79_PROJECT_ID,
      mouStart: CalendarDate.local(2023, 10, 1).toISO(),
      mouEnd: CalendarDate.local(2024, 9, 30).toISO(),
    });
    projectId = project.id;

    const language = await runAsAdmin(app, createLanguage);

    const engagement = await createLanguageEngagement(app, {
      project: projectId,
      language: language.id,
      rev79CommunityId: REV79_COMMUNITY_ID,
      startDateOverride: CalendarDate.local(2023, 10, 1).toISO(),
      endDateOverride: CalendarDate.local(2024, 9, 30).toISO(),
    });
    engagementId = engagement.id;
  });

  describe('rev79QuarterlyReportContext', () => {
    it('resolves context for valid inputs', async () => {
      const result = await app.graphql.query(Rev79QuarterlyReportContextDoc, {
        input: {
          rev79ProjectId: REV79_PROJECT_ID,
          rev79CommunityId: REV79_COMMUNITY_ID,
          period: TARGET_PERIOD,
        },
      });

      const ctx = result.rev79QuarterlyReportContext;
      expect(ctx.project).toBe(projectId);
      expect(ctx.engagement).toBe(engagementId);
      expect(isIdLike(ctx.progressReport)).toBe(true);
      expect(ctx.start).toBe('2024-01-01');
      expect(ctx.end).toBe('2024-03-31');
    });

    it('throws Input when quarter is out of range', async () => {
      await expect(
        app.graphql.query(Rev79QuarterlyReportContextDoc, {
          input: {
            rev79ProjectId: REV79_PROJECT_ID,
            rev79CommunityId: REV79_COMMUNITY_ID,
            period: { year: 2024, quarter: 5 },
          },
        }),
      ).rejects.toThrowGqlError(errors.input());
    });

    it('throws NotFound for unknown rev79ProjectId', async () => {
      await expect(
        app.graphql.query(Rev79QuarterlyReportContextDoc, {
          input: {
            rev79ProjectId: faker.string.uuid(),
            rev79CommunityId: REV79_COMMUNITY_ID,
            period: TARGET_PERIOD,
          },
        }),
      ).rejects.toThrowGqlError(errors.notFound());
    });

    it('throws NotFound for unknown rev79CommunityId', async () => {
      await expect(
        app.graphql.query(Rev79QuarterlyReportContextDoc, {
          input: {
            rev79ProjectId: REV79_PROJECT_ID,
            rev79CommunityId: faker.string.uuid(),
            period: TARGET_PERIOD,
          },
        }),
      ).rejects.toThrowGqlError(errors.notFound());
    });

    it('throws NotFound when no progress report exists for period', async () => {
      await expect(
        app.graphql.query(Rev79QuarterlyReportContextDoc, {
          input: {
            rev79ProjectId: REV79_PROJECT_ID,
            rev79CommunityId: REV79_COMMUNITY_ID,
            period: { year: 2027, quarter: 2 }, // outside MOU window
          },
        }),
      ).rejects.toThrowGqlError(errors.notFound());
    });
  });

  describe('uploadRev79ProgressReports', () => {
    it('uploads with rich text teamNews', async () => {
      const result = await app.graphql.mutate(UploadRev79ProgressReportsDoc, {
        input: {
          rev79ProjectId: REV79_PROJECT_ID,
          reports: [
            {
              rev79CommunityId: REV79_COMMUNITY_ID,
              period: TARGET_PERIOD,
              teamNews: {
                response: {
                  type: 'doc',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Great quarter!' }],
                    },
                  ],
                },
              },
            },
          ],
        },
      });

      const { results } = result.uploadRev79ProgressReports;
      expect(results).toHaveLength(1);
      expect(results[0]!.rev79CommunityId).toBe(REV79_COMMUNITY_ID);
      expect(isIdLike(results[0]!.progressReport)).toBe(true);
    });

    it('uploads with null teamNews response', async () => {
      const result = await app.graphql.mutate(UploadRev79ProgressReportsDoc, {
        input: {
          rev79ProjectId: REV79_PROJECT_ID,
          reports: [
            {
              rev79CommunityId: REV79_COMMUNITY_ID,
              period: TARGET_PERIOD,
              teamNews: { response: null },
            },
          ],
        },
      });

      const { results } = result.uploadRev79ProgressReports;
      expect(results).toHaveLength(1);
      expect(results[0]!.rev79CommunityId).toBe(REV79_COMMUNITY_ID);
      expect(isIdLike(results[0]!.progressReport)).toBe(true);
    });

    it('uploads with no optional content fields', async () => {
      const result = await app.graphql.mutate(UploadRev79ProgressReportsDoc, {
        input: {
          rev79ProjectId: REV79_PROJECT_ID,
          reports: [
            {
              rev79CommunityId: REV79_COMMUNITY_ID,
              period: TARGET_PERIOD,
            },
          ],
        },
      });

      const { results } = result.uploadRev79ProgressReports;
      expect(results).toHaveLength(1);
      expect(isIdLike(results[0]!.progressReport)).toBe(true);
    });

    it('throws NotFound for unknown rev79ProjectId', async () => {
      await expect(
        app.graphql.mutate(UploadRev79ProgressReportsDoc, {
          input: {
            rev79ProjectId: faker.string.uuid(),
            reports: [
              {
                rev79CommunityId: REV79_COMMUNITY_ID,
                period: TARGET_PERIOD,
              },
            ],
          },
        }),
      ).rejects.toThrowGqlError(errors.notFound());
    });

    it('throws NotFound for unknown rev79CommunityId', async () => {
      await expect(
        app.graphql.mutate(UploadRev79ProgressReportsDoc, {
          input: {
            rev79ProjectId: REV79_PROJECT_ID,
            reports: [
              {
                rev79CommunityId: faker.string.uuid(),
                period: TARGET_PERIOD,
              },
            ],
          },
        }),
      ).rejects.toThrowGqlError(errors.notFound());
    });
  });
});

const Rev79QuarterlyReportContextDoc = graphql(`
  query Rev79QuarterlyReportContext($input: Rev79QuarterlyReportContextInput!) {
    rev79QuarterlyReportContext(input: $input) {
      project
      engagement
      progressReport
      start
      end
    }
  }
`);

const UploadRev79ProgressReportsDoc = graphql(`
  mutation UploadRev79ProgressReports(
    $input: Rev79BulkUploadProgressReportsInput!
  ) {
    uploadRev79ProgressReports(input: $input) {
      results {
        rev79CommunityId
        progressReport
      }
    }
  }
`);
