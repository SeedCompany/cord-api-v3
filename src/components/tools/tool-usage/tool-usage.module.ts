import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { ToolCoreModule } from '../tool/tool.module';
import { ResourceToolsResolver } from './resource-tools.resolver';
import { ToolContainerSummaryLoader } from './tool-container-summary.loader';
import { ToolUsageByContainerLoader } from './tool-usage-by-container.loader';
import { ToolUsageByToolLoader } from './tool-usage-by-tool.loader';
import { ToolUsageDrizzleRepository } from './tool-usage.drizzle.repository';
import { ToolUsageRepository as GelRepository } from './tool-usage.gel.repository';
import { ToolUsageLoader } from './tool-usage.loader';
import { ToolUsageRepository as Neo4jRepository } from './tool-usage.neo4j.repository';
import { ToolUsageResolver } from './tool-usage.resolver';
import { ToolUsageService } from './tool-usage.service';
import { ToolUsagesResolver } from './tool-usages.resolver';

@Module({
  imports: [ToolCoreModule],
  providers: [
    ToolUsageResolver,
    ResourceToolsResolver,
    ToolUsagesResolver,
    ToolUsageLoader,
    ToolUsageByContainerLoader,
    ToolUsageByToolLoader,
    ToolContainerSummaryLoader,
    ToolUsageService,
    splitDb(Neo4jRepository, {
      gel: GelRepository,
      // migration-todo: drop the Neo4j path (and this splitDb) at Phase 7 cutover.
      // migration-todo: remove `as any` once splitDb types accept drizzle repos.
      postgres: ToolUsageDrizzleRepository as any,
    }),
  ],
  exports: [ToolUsageService],
})
export class ToolUsageModule {}
