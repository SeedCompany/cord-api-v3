import { Module } from '@nestjs/common';
import { WorkflowResolver } from './workflow.resolver';
import { WorkflowService } from './workflow.service';
import { WorkflowRepository } from './workflow.repository';

@Module({
  providers: [WorkflowService, WorkflowResolver, WorkflowRepository],
})
export class WorkflowModule {}
