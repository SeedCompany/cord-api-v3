import { forwardRef, Module } from '@nestjs/common';
import { ToolModule } from '../tool.module';
import { ResourceToolsResolver } from './resource-tools.resolver';
import { ToolUsageLoader } from './tool-usage.loader';
import { ToolUsageRepository } from './tool-usage.repository';
import { ToolUsageResolver } from './tool-usage.resolver';
import { ToolUsageService } from './tool-usage.service';

@Module({
  imports: [forwardRef(() => ToolModule)],
  providers: [
    ToolUsageService,
    ToolUsageRepository,
    ToolUsageResolver,
    ToolUsageLoader,
    ResourceToolsResolver,
  ],
  exports: [ToolUsageService, ResourceToolsResolver],
})
export class ToolUsageModule {}
