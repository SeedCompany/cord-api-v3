import { Module } from '@nestjs/common';
import { ToolLoader } from './tool.loader';
import { ToolRepository } from './tool.repository';
import { ToolResolver } from './tool.resolver';
import { ToolService } from './tool.service';

@Module({
  providers: [ToolResolver, ToolLoader, ToolService, ToolRepository],
  exports: [ToolService],
})
export class ToolCoreModule {}
