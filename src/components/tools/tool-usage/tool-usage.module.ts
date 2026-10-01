import { Module } from '@nestjs/common';
import { ToolCoreModule } from '../tool/tool.module';
import { ResourceToolsResolver } from './resource-tools.resolver';
import { ToolContainerSummaryLoader } from './tool-container-summary.loader';
import { ToolUsageByContainerLoader } from './tool-usage-by-container.loader';
import { ToolUsageByToolLoader } from './tool-usage-by-tool.loader';
import { ToolUsageLoader } from './tool-usage.loader';
import { ToolUsageRepository } from './tool-usage.repository';
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
    ToolUsageRepository,
  ],
  exports: [ToolUsageService],
})
export class ToolUsageModule {}
