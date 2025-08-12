import { Module } from '@nestjs/common';
import { ToolUsageModule } from './tool-usage/tool-usage.module';
import { ToolLoader } from './tool.loader';
import { ToolRepository } from './tool.repository';
import { ToolResolver } from './tool.resolver';
import { ToolService } from './tool.service';

@Module({
  imports: [ToolUsageModule],
  providers: [ToolResolver, ToolService, ToolLoader, ToolRepository],
  exports: [ToolService, ToolUsageModule],
})
export class ToolModule {}
