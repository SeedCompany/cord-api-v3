import { Module } from '@nestjs/common';
import { ToolUsageModule } from './tool-usage/tool-usage.module';
import { ToolCoreModule } from './tool/tool.module';

const submodules = [ToolCoreModule, ToolUsageModule];

@Module({
  imports: submodules,
  exports: submodules,
})
export class ToolModule {}
