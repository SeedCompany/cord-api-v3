import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CalendarDate, type ID, NotFoundException } from '~/common';
import type { Rev79QuarterlyReportContextInput } from './dto';
import {
  AmbiguousRev79CommunityException,
  ProgressReportNotFoundException,
  QuarterOutOfRangeException,
  Rev79CommunityNotFoundException,
  Rev79ProjectNotFoundException,
} from './rev79.exceptions';
import { Rev79Service } from './rev79.service';

const PROJECT_ID = 'project-uuid-1' as ID<'Project'>;
const ENGAGEMENT_ID = 'engagement-uuid-1' as ID<'LanguageEngagement'>;
const REPORT_ID = 'report-uuid-1' as ID<'ProgressReport'>;
const Q1_START = CalendarDate.fromObject({ year: 2024, month: 1, day: 1 });
const Q1_END = CalendarDate.fromObject({ year: 2024, month: 3, day: 31 });

const makeInput = (
  overrides: Partial<Rev79QuarterlyReportContextInput> = {},
): Rev79QuarterlyReportContextInput => ({
  rev79ProjectId: 'proj-123',
  rev79CommunityId: 'comm-456',
  period: { year: 2024, quarter: 1 },
  ...overrides,
});

describe('Rev79Service', () => {
  let service: Rev79Service;
  // Typed as `any` to keep mock setup simple without fighting strict inference.
  let repo: any;
  let projectService: any;
  let periodicReportService: any;

  beforeEach(() => {
    repo = {
      findProjectsByRev79Id: jest.fn(),
      findEngagementsByRev79CommunityId: jest.fn(),
    };

    projectService = {
      readOne: jest.fn(),
    };

    periodicReportService = {
      getReportByDate: jest.fn(),
    };

    service = new Rev79Service(
      repo,
      projectService,
      periodicReportService,
      {} as any, // teamNewsService — not used by resolveQuarterlyReportContext
      {} as any, // communityStoryService — not used by resolveQuarterlyReportContext
      {} as any, // productProgressService — not used by resolveQuarterlyReportContext
      { debug: jest.fn() } as any,
    );

    // Happy-path defaults
    repo.findProjectsByRev79Id.mockResolvedValue([{ id: PROJECT_ID }]);
    projectService.readOne.mockResolvedValue({ id: PROJECT_ID });
    repo.findEngagementsByRev79CommunityId.mockResolvedValue([
      { id: ENGAGEMENT_ID },
    ]);
    periodicReportService.getReportByDate.mockResolvedValue({
      id: REPORT_ID,
      start: Q1_START,
      end: Q1_END,
    });
  });

  it('returns correct IDs and dates on the happy path', async () => {
    const result = await service.resolveQuarterlyReportContext(makeInput());
    expect(result.project).toBe(PROJECT_ID);
    expect(result.engagement).toBe(ENGAGEMENT_ID);
    expect(result.progressReport).toBe(REPORT_ID);
    expect(result.start).toEqual(Q1_START);
    expect(result.end).toEqual(Q1_END);
  });

  it('passes the first day of the quarter to getReportByDate', async () => {
    await service.resolveQuarterlyReportContext(
      makeInput({ period: { year: 2024, quarter: 3 } }),
    );
    const expectedDate = CalendarDate.fromObject({
      year: 2024,
      month: 7,
      day: 1,
    });
    expect(periodicReportService.getReportByDate).toHaveBeenCalledWith(
      ENGAGEMENT_ID,
      expectedDate,
      'Progress',
    );
  });

  describe('QuarterOutOfRangeException', () => {
    it('throws for quarter 0', async () => {
      await expect(
        service.resolveQuarterlyReportContext(
          makeInput({ period: { year: 2024, quarter: 0 } }),
        ),
      ).rejects.toThrow(QuarterOutOfRangeException);
    });

    it('throws for quarter 5', async () => {
      await expect(
        service.resolveQuarterlyReportContext(
          makeInput({ period: { year: 2024, quarter: 5 } }),
        ),
      ).rejects.toThrow(QuarterOutOfRangeException);
    });
  });

  it('throws Rev79ProjectNotFoundException when no project matches', async () => {
    repo.findProjectsByRev79Id.mockResolvedValue([]);
    await expect(
      service.resolveQuarterlyReportContext(makeInput()),
    ).rejects.toThrow(Rev79ProjectNotFoundException);
  });

  it('throws Rev79ProjectNotFoundException when project exists but user cannot read it', async () => {
    projectService.readOne.mockRejectedValue(
      new NotFoundException('Could not find project'),
    );
    await expect(
      service.resolveQuarterlyReportContext(makeInput()),
    ).rejects.toThrow(Rev79ProjectNotFoundException);
  });

  it('throws Rev79CommunityNotFoundException when no engagement matches', async () => {
    repo.findEngagementsByRev79CommunityId.mockResolvedValue([]);
    await expect(
      service.resolveQuarterlyReportContext(makeInput()),
    ).rejects.toThrow(Rev79CommunityNotFoundException);
  });

  it('throws AmbiguousRev79CommunityException when multiple engagements match', async () => {
    repo.findEngagementsByRev79CommunityId.mockResolvedValue([
      { id: ENGAGEMENT_ID },
      { id: 'engagement-uuid-2' as ID<'LanguageEngagement'> },
    ]);
    await expect(
      service.resolveQuarterlyReportContext(makeInput()),
    ).rejects.toThrow(AmbiguousRev79CommunityException);
  });

  it('throws ProgressReportNotFoundException when no report exists for the quarter', async () => {
    periodicReportService.getReportByDate.mockResolvedValue(undefined);
    await expect(
      service.resolveQuarterlyReportContext(makeInput()),
    ).rejects.toThrow(ProgressReportNotFoundException);
  });

  it('re-throws unexpected errors from projectService.readOne unchanged', async () => {
    const unexpectedError = new Error('DB connection lost');
    projectService.readOne.mockRejectedValue(unexpectedError);
    await expect(
      service.resolveQuarterlyReportContext(makeInput()),
    ).rejects.toThrow(unexpectedError);
  });
});
