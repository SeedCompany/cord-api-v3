import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ID, IdArg, LoggedInSession, Session } from '~/common';
import { ResourceLoader } from '~/core';
import { ProgressReport, ProgressReportStatus } from '../../dto';
import { ProgressReportWorkflowService } from '../progress-report-workflow.service';

@Resolver()
export class ProgressReportExecuteTransitionResolver {
  constructor(
    private readonly workflow: ProgressReportWorkflowService,
    private readonly resources: ResourceLoader
  ) {}

  @Mutation(() => ProgressReport)
  async transitionProgressReport(
    @IdArg() reportId: ID,
    @IdArg({
      name: 'transition',
      nullable: true,
      description: 'Execute this transition',
    })
    transitionId: ID | undefined,
    @Args({
      name: 'status',
      type: () => ProgressReportStatus,
      nullable: true,
      description: 'Bypass the workflow, and go straight to this status.',
    })
    status: ProgressReportStatus | undefined,
    @LoggedInSession() session: Session
  ): Promise<ProgressReport> {
    await this.workflow.executeTransition(
      reportId,
      transitionId,
      status,
      session
    );
    return await this.resources.load(ProgressReport, reportId);
  }
}
