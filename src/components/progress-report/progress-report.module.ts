import { forwardRef, Module } from '@nestjs/common';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { ProgressReportCommunityStoryRepository } from './community-stories/progress-report-community-story.repository';
import { ProgressReportCommunityStoryResolver } from './community-stories/progress-report-community-story.resolver';
import { ProgressReportCommunityStoryService } from './community-stories/progress-report-community-story.service';
import { ProgressReportHighlightsRepository } from './highlights/progress-report-highlights.repository';
import { ProgressReportHighlightsResolver } from './highlights/progress-report-highlights.resolver';
import { ProgressReportHighlightsService } from './highlights/progress-report-highlights.service';
import { AddProgressReportStatusMigration } from './migrations/AddStatus.migration';
import { ProgressReportExtraForPeriodicInterfaceRepository } from './progress-report-extra-for-periodic-interface.repository';
import { ProgressReportRepository } from './progress-report.repository';
import { ProgressReportService } from './progress-report.service';
import { ProgressReportEngagementConnectionResolver } from './resolvers/progress-report-engagement-connection.resolver';
import { ProgressReportParentResolver } from './resolvers/progress-report-parent.resolver';
import { ProgressReportVarianceExplanationModule } from './variance-explanation/variance-explanation.module';
import { ProgressReportWorkflowModule } from './workflow/progress-report-workflow.module';

@Module({
  imports: [
    forwardRef(() => PeriodicReportModule),
    ProgressReportWorkflowModule,
    ProgressReportVarianceExplanationModule,
  ],
  providers: [
    ProgressReportParentResolver,
    ProgressReportEngagementConnectionResolver,
    ProgressReportHighlightsResolver,
    ProgressReportHighlightsService,
    ProgressReportHighlightsRepository,
    ProgressReportCommunityStoryResolver,
    ProgressReportCommunityStoryService,
    ProgressReportCommunityStoryRepository,
    ProgressReportService,
    ProgressReportRepository,
    ProgressReportExtraForPeriodicInterfaceRepository,
    AddProgressReportStatusMigration,
  ],
  exports: [ProgressReportExtraForPeriodicInterfaceRepository],
})
export class ProgressReportModule {}
