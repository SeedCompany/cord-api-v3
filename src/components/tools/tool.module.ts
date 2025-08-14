import { Module } from '@nestjs/common';
import { ToolCoreModule } from './tool/tool.module';

const submodules = [ToolCoreModule];

@Module({
  imports: submodules,
  exports: submodules,
})
export class ToolModule {}
