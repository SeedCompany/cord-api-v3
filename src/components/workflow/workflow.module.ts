import { Module } from '@nestjs/common';
import { WorkflowResolver } from './workflow.resolver';
import { WorkflowService } from './workflow.service';

@Module({
  providers: [WorkflowService, WorkflowResolver],
})
export class WorkflowModule {}
