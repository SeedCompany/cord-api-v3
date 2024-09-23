import { forwardRef, Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { ProgressReportCommunityStoryRepository } from './community-stories/progress-report-community-story.repository';
import { ProgressReportCommunityStoryResolver } from './community-stories/progress-report-community-story.resolver';
import { ProgressReportCommunityStoryService } from './community-stories/progress-report-community-story.service';
import { ProgressReportHighlightsRepository } from './highlights/progress-report-highlights.repository';
import { ProgressReportHighlightsResolver } from './highlights/progress-report-highlights.resolver';
import { ProgressReportHighlightsService } from './highlights/progress-report-highlights.service';
import { ProgressReportMediaModule } from './media/progress-report-media.module';
import { ProgressReportExtraForPeriodicInterfaceRepository } from './progress-report-extra-for-periodic-interface.repository';
import { ProgressReportRepository } from './progress-report.repository';
import { ProgressReportService } from './progress-report.service';
import { ProgressReportEngagementConnectionResolver } from './resolvers/progress-report-engagement-connection.resolver';
import { ProgressReportParentResolver } from './resolvers/progress-report-parent.resolver';
import { ProgressReportResolver } from './resolvers/progress-report.resolver';
import { ReextractPnpResolver } from './resolvers/reextract-pnp.resolver';
import { ProgressReportTeamNewsRepository } from './team-news/progress-report-team-news.repository';
import { ProgressReportTeamNewsResolver } from './team-news/progress-report-team-news.resolver';
import { ProgressReportTeamNewsService } from './team-news/progress-report-team-news.service';
import { ProgressReportVarianceExplanationModule } from './variance-explanation/variance-explanation.module';
import { ProgressReportWorkflowModule } from './workflow/progress-report-workflow.module';

@Module({
  imports: [
    forwardRef(() => PeriodicReportModule),
    ProgressReportWorkflowModule,
    ProgressReportVarianceExplanationModule,
    ProgressReportMediaModule,
    FileModule,
  ],
  providers: [
    ProgressReportResolver,
    ProgressReportParentResolver,
    ProgressReportEngagementConnectionResolver,
    ReextractPnpResolver,
    ProgressReportTeamNewsResolver,
    ProgressReportTeamNewsService,
    ProgressReportTeamNewsRepository,
    ProgressReportHighlightsResolver,
    ProgressReportHighlightsService,
    ProgressReportHighlightsRepository,
    ProgressReportCommunityStoryResolver,
    ProgressReportCommunityStoryService,
    ProgressReportCommunityStoryRepository,
    ProgressReportService,
    ProgressReportRepository,
    ProgressReportExtraForPeriodicInterfaceRepository,
  ],
  exports: [ProgressReportExtraForPeriodicInterfaceRepository],
})
export class ProgressReportModule {}
