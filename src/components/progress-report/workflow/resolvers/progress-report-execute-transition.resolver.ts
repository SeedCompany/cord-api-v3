import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '~/common';
import { ResourceLoader } from '~/core';
import { ProgressReport } from '../../dto';
import { ExecuteProgressReportTransitionInput } from '../dto/execute-progress-report-transition.input';
import { ProgressReportWorkflowService } from '../progress-report-workflow.service';

@Resolver()
export class ProgressReportExecuteTransitionResolver {
  constructor(
    private readonly workflow: ProgressReportWorkflowService,
    private readonly resources: ResourceLoader
  ) {}

  @Mutation(() => ProgressReport)
  async transitionProgressReport(
    @Args() input: ExecuteProgressReportTransitionInput,
    @LoggedInSession() session: Session
  ): Promise<ProgressReport> {
    await this.workflow.executeTransition(input, session);
    return await this.resources.load(ProgressReport, input.reportId);
  }
}
