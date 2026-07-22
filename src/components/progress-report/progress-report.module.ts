import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { FileModule } from '../file/file.module';
import { PeriodicReportModule } from '../periodic-report/periodic-report.module';
import { ProgressReportCommunityStoryDrizzleRepository } from './community-stories/progress-report-community-story.drizzle.repository';
import { ProgressReportCommunityStoryRepository } from './community-stories/progress-report-community-story.repository';
import { ProgressReportCommunityStoryResolver } from './community-stories/progress-report-community-story.resolver';
import { ProgressReportCommunityStoryService } from './community-stories/progress-report-community-story.service';
import { ProgressReportHighlightsDrizzleRepository } from './highlights/progress-report-highlights.drizzle.repository';
import { ProgressReportHighlightsRepository } from './highlights/progress-report-highlights.repository';
import { ProgressReportHighlightsResolver } from './highlights/progress-report-highlights.resolver';
import { ProgressReportHighlightsService } from './highlights/progress-report-highlights.service';
import { ProgressReportMediaModule } from './media/progress-report-media.module';
import { BackfillMultiplicationProgressReportFilePublicMigration } from './migrations/backfill-multiplication-progress-report-file-public.migration';
import { DropDuplicateMultiplicationProgressReportsMigration } from './migrations/drop-duplicate-multiplication-progress-reports.migration';
import { DropInternshipProgressReportsMigration } from './migrations/drop-internship-progress-reports.migration';
import { ReextractPnpProgressReportsMigration } from './migrations/reextract-all-progress-reports.migration';
import { ProgressReportExtraForPeriodicInterfaceRepository } from './progress-report-extra-for-periodic-interface.repository';
import { ProgressReportRepository } from './progress-report.repository';
import { ProgressReportService } from './progress-report.service';
import { ProgressReportEngagementConnectionResolver } from './resolvers/progress-report-engagement-connection.resolver';
import { ProgressReportParentResolver } from './resolvers/progress-report-parent.resolver';
import { ProgressReportResolver } from './resolvers/progress-report.resolver';
import { ReextractPnpResolver } from './resolvers/reextract-pnp.resolver';
import { ProgressReportTeamNewsDrizzleRepository } from './team-news/progress-report-team-news.drizzle.repository';
import { ProgressReportTeamNewsRepository } from './team-news/progress-report-team-news.repository';
import { ProgressReportTeamNewsResolver } from './team-news/progress-report-team-news.resolver';
import { ProgressReportTeamNewsService } from './team-news/progress-report-team-news.service';
import { ProgressReportVarianceExplanationModule } from './variance-explanation/variance-explanation.module';
import { ProgressReportWorkflowModule } from './workflow/progress-report-workflow.module';

@Module({
  imports: [
    forwardRef(() => PeriodicReportModule),
    forwardRef(() => ProgressReportWorkflowModule),
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
    splitDb(ProgressReportTeamNewsRepository, {
      // migration-todo: `as any` removed at Phase 7 cutover when splitDb
      // disappears with the Neo4j path.
      postgres: ProgressReportTeamNewsDrizzleRepository as any,
    }),
    ProgressReportHighlightsResolver,
    ProgressReportHighlightsService,
    splitDb(ProgressReportHighlightsRepository, {
      // migration-todo: `as any` removed at Phase 7 cutover.
      postgres: ProgressReportHighlightsDrizzleRepository as any,
    }),
    ProgressReportCommunityStoryResolver,
    ProgressReportCommunityStoryService,
    splitDb(ProgressReportCommunityStoryRepository, {
      // migration-todo: `as any` removed at Phase 7 cutover.
      postgres: ProgressReportCommunityStoryDrizzleRepository as any,
    }),
    ProgressReportService,
    ProgressReportRepository,
    ProgressReportExtraForPeriodicInterfaceRepository,
    BackfillMultiplicationProgressReportFilePublicMigration,
    DropDuplicateMultiplicationProgressReportsMigration,
    DropInternshipProgressReportsMigration,
    ReextractPnpProgressReportsMigration,
  ],
  exports: [
    ProgressReportExtraForPeriodicInterfaceRepository,
    ProgressReportTeamNewsService,
    ProgressReportCommunityStoryService,
    ProgressReportMediaModule,
  ],
})
export class ProgressReportModule {}
