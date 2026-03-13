import { Injectable } from '@nestjs/common';
import { File } from '@whatwg-node/fetch';
import { type ID, NotFoundException } from '~/common';
import { fullFiscalQuarter } from '~/common/temporal/fiscal-year';
import { ILogger, Logger } from '~/core/logger';
import { PeriodicReportService } from '../periodic-report/periodic-report.service';
import { ProductProgressService } from '../product-progress/product-progress.service';
import { ProgressReportCommunityStoryService } from '../progress-report/community-stories/progress-report-community-story.service';
import { ProgressReportMedia } from '../progress-report/media/dto';
import { ProgressReportMediaService } from '../progress-report/media/progress-report-media.service';
import { ProgressReportTeamNewsService } from '../progress-report/team-news/progress-report-team-news.service';
import { ProjectService } from '../project/project.service';
import type {
  Rev79BulkUploadProgressReportsInput,
  Rev79BulkUploadResult,
  Rev79CommunityStoryInput,
  Rev79MediaInput,
  Rev79QuarterlyReportContextInput,
  Rev79QuarterlyReportContextResult,
  Rev79ReportItemInput,
  Rev79TeamNewsInput,
} from './dto';
import {
  AmbiguousRev79CommunityException,
  AmbiguousRev79ProjectException,
  ProgressReportNotFoundException,
  QuarterOutOfRangeException,
  Rev79CommunityNotFoundException,
  Rev79ProjectNotFoundException,
} from './rev79.exceptions';
import { Rev79Repository } from './rev79.repository';

const TEAM_NEWS_DEFAULT_PROMPT = 'F4eY7VXhPpM';
const TEAM_NEWS_DEFAULT_VARIANT = 'draft';
const COMMUNITY_STORY_DEFAULT_VARIANT = 'draft';

@Injectable()
export class Rev79Service {
  constructor(
    private readonly repo: Rev79Repository,
    private readonly projectService: ProjectService,
    private readonly periodicReportService: PeriodicReportService,
    private readonly teamNewsService: ProgressReportTeamNewsService,
    private readonly communityStoryService: ProgressReportCommunityStoryService,
    private readonly productProgressService: ProductProgressService,
    private readonly mediaService: ProgressReportMediaService,
    @Logger('rev79') private readonly logger: ILogger,
  ) {}

  async resolveQuarterlyReportContext(
    input: Rev79QuarterlyReportContextInput,
  ): Promise<Rev79QuarterlyReportContextResult> {
    const { rev79ProjectId, rev79CommunityId, period } = input;

    this.logger.debug('Received rev79QuarterlyReportContext request', {
      input,
    });

    if (period.quarter < 1 || period.quarter > 4) {
      throw new QuarterOutOfRangeException(period.quarter);
    }

    const projectId = await this.resolveProjectId(rev79ProjectId);

    // --- Resolve engagement ---
    const engagementMatches = await this.repo.findEngagementsByRev79CommunityId(
      projectId,
      rev79CommunityId,
    );
    if (engagementMatches.length === 0) {
      throw new Rev79CommunityNotFoundException(rev79CommunityId);
    }
    if (engagementMatches.length > 1) {
      throw new AmbiguousRev79CommunityException(rev79CommunityId);
    }
    const engagementId = engagementMatches[0]!.id;

    // --- Resolve progress report ---
    const quarterStart = fullFiscalQuarter(period.quarter, period.year).start;
    const report = await this.periodicReportService.getReportByDate(
      engagementId,
      quarterStart,
      'Progress',
    );
    if (!report) {
      throw new ProgressReportNotFoundException(period.year, period.quarter);
    }

    const reportId = report.id as ID<'ProgressReport'>;

    return {
      project: projectId,
      engagement: engagementId,
      progressReport: reportId,
      start: report.start,
      end: report.end,
    };
  }

  async uploadProgressReports(
    input: Rev79BulkUploadProgressReportsInput,
  ): Promise<Rev79BulkUploadResult> {
    const { rev79ProjectId, reports } = input;

    this.logger.debug('Received uploadRev79ProgressReports request', {
      rev79ProjectId,
      count: reports.length,
    });

    const projectId = await this.resolveProjectId(rev79ProjectId);

    const results = [];
    for (const item of reports) {
      results.push(await this.processReportItem(projectId, item));
    }

    return { results };
  }

  /**
   * Looks up the Cord project by Rev79 project ID and verifies the current
   * user can read it. Surfaces any auth failure as a typed not-found error to
   * avoid leaking project existence.
   */
  private async resolveProjectId(
    rev79ProjectId: string,
  ): Promise<ID<'Project'>> {
    const matches = await this.repo.findProjectsByRev79Id(rev79ProjectId);
    if (matches.length === 0) {
      throw new Rev79ProjectNotFoundException(rev79ProjectId);
    }
    if (matches.length > 1) {
      throw new AmbiguousRev79ProjectException(rev79ProjectId);
    }
    const projectId = matches[0]!.id;
    try {
      await this.projectService.readOne(projectId);
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw new Rev79ProjectNotFoundException(rev79ProjectId);
      }
      throw e;
    }
    return projectId;
  }

  private async processReportItem(
    projectId: ID<'Project'>,
    item: Rev79ReportItemInput,
  ) {
    const { rev79CommunityId, period } = item;

    if (period.quarter < 1 || period.quarter > 4) {
      throw new QuarterOutOfRangeException(period.quarter);
    }

    const engagementMatches = await this.repo.findEngagementsByRev79CommunityId(
      projectId,
      rev79CommunityId,
    );
    if (engagementMatches.length === 0) {
      throw new Rev79CommunityNotFoundException(rev79CommunityId);
    }
    if (engagementMatches.length > 1) {
      throw new AmbiguousRev79CommunityException(rev79CommunityId);
    }
    const engagementId = engagementMatches[0]!.id;

    const quarterStart = fullFiscalQuarter(period.quarter, period.year).start;
    const report = await this.periodicReportService.getReportByDate(
      engagementId,
      quarterStart,
      'Progress',
    );
    if (!report) {
      throw new ProgressReportNotFoundException(period.year, period.quarter);
    }
    const reportId = report.id as ID<'ProgressReport'>;

    if (item.teamNews) {
      await this.applyTeamNews(report, reportId, item.teamNews);
    }

    if (item.communityStories?.length) {
      for (const story of item.communityStories) {
        await this.applyCommunityStory(report, reportId, story);
      }
    }

    if (item.productProgress?.length) {
      for (const progress of item.productProgress) {
        await this.productProgressService.update({
          ...progress,
          report: reportId,
        });
      }
    }

    if (item.media?.length) {
      for (const m of item.media) {
        await this.applyMedia(reportId, m);
      }
    }

    return { rev79CommunityId, progressReport: reportId };
  }

  private async applyTeamNews(
    report: any,
    reportId: ID<'ProgressReport'>,
    input: Rev79TeamNewsInput,
  ) {
    const list = await this.teamNewsService.list(report);
    let pvrId: ID;
    if (list.items.length > 0) {
      pvrId = list.items[0]!.id;
    } else {
      const created = await this.teamNewsService.create({
        resource: reportId,
        prompt: TEAM_NEWS_DEFAULT_PROMPT as ID,
      });
      pvrId = created.id;
    }
    await this.teamNewsService.submitResponse({
      id: pvrId,
      variant: TEAM_NEWS_DEFAULT_VARIANT as any,
      response: input.response,
    });
  }

  private async applyMedia(
    reportId: ID<'ProgressReport'>,
    input: Rev79MediaInput,
  ) {
    const response = await fetch(input.url);
    if (!response.ok) {
      throw new Error(
        `Failed to download media from Rev79: ${response.status} ${response.statusText}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream';
    const urlPath = new URL(input.url).pathname;
    const filename = urlPath.split('/').pop() ?? 'image';

    const file = new File([buffer], filename, { type: contentType });

    await this.mediaService.upload({
      report: reportId,
      file: { file, name: filename },
      variant: ProgressReportMedia.Variants.byKey('draft'),
      category: input.category,
    });
  }

  private async applyCommunityStory(
    report: any,
    reportId: ID<'ProgressReport'>,
    input: Rev79CommunityStoryInput,
  ) {
    const list = await this.communityStoryService.list(report);
    const existing = list.items.find(
      (pvr) => pvr.prompt.value?.id === input.promptId,
    );
    let pvrId: ID;
    if (existing) {
      pvrId = existing.id;
    } else {
      const created = await this.communityStoryService.create({
        resource: reportId,
        prompt: input.promptId,
      });
      pvrId = created.id;
    }
    await this.communityStoryService.submitResponse({
      id: pvrId,
      variant: COMMUNITY_STORY_DEFAULT_VARIANT as any,
      response: input.response,
    });
  }
}
