import { Module } from '@nestjs/common';
import { WorkflowRepository } from './workflow.repository';
import { WorkflowResolver } from './workflow.resolver';
import { WorkflowService } from './workflow.service';

@Module({
  providers: [WorkflowService, WorkflowResolver, WorkflowRepository],
})
export class WorkflowModule {}
