import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { type ID } from '~/common';
import type { Rev79Service as Rev79ServiceClass } from './rev79.service';

// In ESM mode (ts-jest/presets/default-esm), jest.mock() is NOT hoisted and
// cannot intercept ES module imports. unstable_mockModule + dynamic import is
// required to prevent the transitive EngagementRepository circular-dep TDZ error.
jest.unstable_mockModule('../project/project.service', () => ({
  ProjectService: class {},
}));
jest.unstable_mockModule('../periodic-report/periodic-report.service', () => ({
  PeriodicReportService: class {},
}));
jest.unstable_mockModule(
  '../progress-report/team-news/progress-report-team-news.service',
  () => ({ ProgressReportTeamNewsService: class {} }),
);
jest.unstable_mockModule(
  '../progress-report/community-stories/progress-report-community-story.service',
  () => ({ ProgressReportCommunityStoryService: class {} }),
);
jest.unstable_mockModule(
  '../product-progress/product-progress.service',
  () => ({
    ProductProgressService: class {},
  }),
);
jest.unstable_mockModule(
  '../progress-report/media/progress-report-media.service',
  () => ({ ProgressReportMediaService: class {} }),
);
jest.unstable_mockModule('../progress-report/media/dto', () => ({
  ProgressReportMedia: {
    Variants: { byKey: (key: string) => ({ key }) },
    PublicVariants: { has: () => false },
  },
}));
jest.unstable_mockModule('../product-progress/dto', () => ({
  ProgressReportVariantProgress: {
    Variants: { byKey: (key: string) => ({ key }) },
  },
}));
jest.unstable_mockModule('~/core/logger', () => ({
  Logger: () => () => undefined,
  ILogger: class {},
}));

const PROJECT_ID = 'project-uuid-1' as ID<'Project'>;
const ENGAGEMENT_ID = 'engagement-uuid-1' as ID<'LanguageEngagement'>;
const REPORT_ID = 'report-uuid-1' as ID<'ProgressReport'>;

const makeUploadInput = (
  mediaUrls: Array<{ url: string; category?: string; description?: string }>,
): any => ({
  rev79ProjectId: 'proj-123',
  reports: [
    {
      rev79CommunityId: 'comm-456',
      period: { year: 2024, quarter: 1 },
      media: mediaUrls,
    },
  ],
});

describe('Rev79Service — applyMedia', () => {
  let Rev79Service: typeof Rev79ServiceClass;
  let service: Rev79ServiceClass;
  // Typed as `any` to keep mock setup simple without fighting strict inference.
  let repo: any;
  let projectService: any;
  let periodicReportService: any;
  let mediaService: any;
  let productProgressService: any;
  let fetchSpy: ReturnType<typeof jest.spyOn>;

  beforeAll(async () => {
    ({ Rev79Service } = await import('./rev79.service'));
  });

  beforeEach(() => {
    repo = {
      findProjectsByRev79Id: jest.fn(),
      findEngagementsByRev79CommunityId: jest.fn(),
    };

    projectService = { readOne: jest.fn() };
    periodicReportService = { getReportByDate: jest.fn() };
    mediaService = { upload: jest.fn() };
    productProgressService = { update: jest.fn() };

    repo.findProjectsByRev79Id.mockResolvedValue([{ id: PROJECT_ID }]);
    repo.findEngagementsByRev79CommunityId.mockResolvedValue([
      { id: ENGAGEMENT_ID },
    ]);
    projectService.readOne.mockResolvedValue({ id: PROJECT_ID });
    periodicReportService.getReportByDate.mockResolvedValue({
      id: REPORT_ID,
      start: { year: 2024, month: 1, day: 1 },
      end: { year: 2024, month: 3, day: 31 },
    });
    mediaService.upload.mockResolvedValue(undefined);

    service = new Rev79Service(
      repo,
      projectService,
      periodicReportService,
      {} as any, // teamNewsService
      {} as any, // communityStoryService
      productProgressService,
      mediaService,
      { debug: jest.fn() } as any,
    );

    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(Buffer.from('fake-image-bytes'), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('fetches the URL and calls mediaService.upload with the report ID and category', async () => {
    const imageUrl =
      'https://storage.googleapis.com/bucket/path/to/photo.jpg?X-Goog-Signature=abc';

    await service.uploadProgressReports(
      makeUploadInput([{ url: imageUrl, category: 'Team' }]),
    );

    expect(fetchSpy).toHaveBeenCalledWith(imageUrl);
    expect(mediaService.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        report: REPORT_ID,
        category: 'Team',
      }),
    );
  });

  it('maps Rev79 media description to caption metadata', async () => {
    const imageUrl = 'https://storage.googleapis.com/bucket/path/to/photo.jpg';

    await service.uploadProgressReports(
      makeUploadInput([
        {
          url: imageUrl,
          description: 'Community leaders meeting after worship service',
        },
      ]),
    );

    expect(mediaService.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({
          media: expect.objectContaining({
            caption: 'Community leaders meeting after worship service',
          }),
        }),
      }),
    );
  });

  it('extracts filename from the URL path segment', async () => {
    await service.uploadProgressReports(
      makeUploadInput([
        { url: 'https://storage.googleapis.com/bucket/photos/team-photo.png' },
      ]),
    );

    expect(mediaService.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({ name: 'team-photo.png' }),
      }),
    );
  });

  it('calls mediaService.upload once per image', async () => {
    await service.uploadProgressReports(
      makeUploadInput([
        {
          url: 'https://storage.googleapis.com/bucket/a.jpg',
          category: 'Team',
        },
        {
          url: 'https://storage.googleapis.com/bucket/b.jpg',
          category: 'Events',
        },
      ]),
    );

    expect(mediaService.upload).toHaveBeenCalledTimes(2);
  });

  it('throws when the image URL returns a non-200 response', async () => {
    fetchSpy.mockResolvedValue(
      new Response(null, { status: 404, statusText: 'Not Found' }),
    );

    await expect(
      service.uploadProgressReports(
        makeUploadInput([
          { url: 'https://storage.googleapis.com/bucket/gone.jpg' },
        ]),
      ),
    ).rejects.toThrow('Failed to download media from Rev79: 404 Not Found');
  });

  it('skips mediaService.upload entirely when no media is provided', async () => {
    await service.uploadProgressReports({
      rev79ProjectId: 'proj-123',
      reports: [
        {
          rev79CommunityId: 'comm-456',
          period: { year: 2024, quarter: 1 },
        },
      ],
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mediaService.upload).not.toHaveBeenCalled();
  });

  it('routes product progress updates to Field Partner variant', async () => {
    await service.uploadProgressReports({
      rev79ProjectId: 'proj-123',
      reports: [
        {
          rev79CommunityId: 'comm-456',
          period: { year: 2024, quarter: 1 },
          productProgress: [
            {
              product: 'product-1',
              steps: [
                {
                  step: 'Drafting',
                  completed: 1,
                  total: 5,
                },
              ],
            },
          ],
        },
      ],
    } as any);

    expect(productProgressService.update).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: expect.objectContaining({ key: 'partner' }),
      }),
    );
  });
});
