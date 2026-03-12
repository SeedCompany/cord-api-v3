import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { CalendarDate, isValidId } from '~/common';
import { graphql } from '~/graphql';
import { createProject } from './operations/project';
import {
  createApp,
  createTesterWithRole,
  getRootTester,
  type TestApp,
  type Tester,
} from './setup';

const Rev79QueryDoc = graphql(`
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

const CreateLanguageEngagementDoc = graphql(`
  mutation CreateLangEngForRev79($input: CreateLanguageEngagement!) {
    createLanguageEngagement(input: $input) {
      engagement {
        id
        ... on LanguageEngagement {
          progressReports(input: { count: 10 }) {
            items {
              id
              start
              end
            }
          }
        }
      }
    }
  }
`);

const CreateLanguageDoc = graphql(`
  mutation CreateLanguageForRev79($input: CreateLanguage!) {
    createLanguage(input: $input) {
      language {
        id
      }
    }
  }
`);

describe('Rev79 quarterly report context (e2e)', () => {
  let app: TestApp;
  let tester: Tester;
  let root: Tester;

  beforeAll(async () => {
    app = await createApp();
    tester = await createTesterWithRole(app, 'ProjectManager');
    root = await getRootTester(app);
  });

  describe('happy path', () => {
    it('resolves project, engagement, and progress report IDs for a valid quarter', async () => {
      const rev79ProjectId = faker.string.uuid();
      const rev79CommunityId = faker.string.uuid();

      // Create a project spanning exactly Q1 2024 so exactly one progress report exists.
      const project = await tester.apply(
        createProject({
          rev79ProjectId,
          mouStart: CalendarDate.local(2024, 1, 1).toISO(),
          mouEnd: CalendarDate.local(2024, 3, 31).toISO(),
        }),
      );

      // Language must be created as admin.
      const { createLanguage } = await root.run(CreateLanguageDoc, {
        input: { name: faker.lorem.word() + ' ' + faker.string.uuid() },
      });
      const languageId = createLanguage.language.id;

      // Create the language engagement; progress reports are auto-generated.
      const { createLanguageEngagement } = await tester.run(
        CreateLanguageEngagementDoc,
        {
          input: {
            project: project.id,
            language: languageId,
            rev79CommunityId,
          },
        },
      );
      const engagement = createLanguageEngagement.engagement;
      const reports = engagement.progressReports.items as Array<{
        id: string;
        start: string;
        end: string;
      }>;

      expect(reports.length).toBeGreaterThan(0);
      const report = reports[0]!;

      const result = await tester.run(Rev79QueryDoc, {
        input: {
          rev79ProjectId,
          rev79CommunityId,
          period: { year: 2024, quarter: 1 },
        },
      });

      const ctx = result.rev79QuarterlyReportContext;
      expect(isValidId(ctx.project)).toBe(true);
      expect(ctx.project).toBe(project.id);
      expect(isValidId(ctx.engagement)).toBe(true);
      expect(ctx.engagement).toBe(engagement.id);
      expect(isValidId(ctx.progressReport)).toBe(true);
      expect(ctx.progressReport).toBe(report.id);
      expect(ctx.start).toBe(report.start);
      expect(ctx.end).toBe(report.end);
    });
  });

  describe('error cases', () => {
    it('returns QuarterOutOfRange when quarter < 1', async () => {
      await tester
        .run(Rev79QueryDoc, {
          input: {
            rev79ProjectId: 'any',
            rev79CommunityId: 'any',
            period: { year: 2024, quarter: 0 },
          },
        })
        .expectError({ code: ['QuarterOutOfRange', 'Input'] });
    });

    it('returns QuarterOutOfRange when quarter > 4', async () => {
      await tester
        .run(Rev79QueryDoc, {
          input: {
            rev79ProjectId: 'any',
            rev79CommunityId: 'any',
            period: { year: 2024, quarter: 5 },
          },
        })
        .expectError({ code: ['QuarterOutOfRange', 'Input'] });
    });

    it('returns Rev79ProjectNotFound when no project has the given rev79ProjectId', async () => {
      await tester
        .run(Rev79QueryDoc, {
          input: {
            rev79ProjectId: 'nonexistent-rev79-project-id',
            rev79CommunityId: 'any',
            period: { year: 2024, quarter: 1 },
          },
        })
        .expectError({ code: ['Rev79ProjectNotFound', 'NotFound'] });
    });

    it('returns Rev79CommunityNotFound when no engagement has the given rev79CommunityId', async () => {
      const rev79ProjectId = faker.string.uuid();
      await tester.apply(
        createProject({
          rev79ProjectId,
          mouStart: CalendarDate.local(2024, 1, 1).toISO(),
          mouEnd: CalendarDate.local(2024, 3, 31).toISO(),
        }),
      );

      await tester
        .run(Rev79QueryDoc, {
          input: {
            rev79ProjectId,
            rev79CommunityId: 'nonexistent-community-id',
            period: { year: 2024, quarter: 1 },
          },
        })
        .expectError({ code: ['Rev79CommunityNotFound', 'NotFound'] });
    });

    it('returns ProgressReportNotFound when no report exists for the requested quarter', async () => {
      const rev79ProjectId = faker.string.uuid();
      const rev79CommunityId = faker.string.uuid();

      // Project covers Q1 2024 only — no Q2 report will exist.
      const project = await tester.apply(
        createProject({
          rev79ProjectId,
          mouStart: CalendarDate.local(2024, 1, 1).toISO(),
          mouEnd: CalendarDate.local(2024, 3, 31).toISO(),
        }),
      );

      const { createLanguage } = await root.run(CreateLanguageDoc, {
        input: { name: faker.lorem.word() + ' ' + faker.string.uuid() },
      });
      await tester.run(CreateLanguageEngagementDoc, {
        input: {
          project: project.id,
          language: createLanguage.language.id,
          rev79CommunityId,
        },
      });

      await tester
        .run(Rev79QueryDoc, {
          input: {
            rev79ProjectId,
            rev79CommunityId,
            period: { year: 2024, quarter: 2 },
          },
        })
        .expectError({ code: ['ProgressReportNotFound', 'NotFound'] });
    });
  });
});
