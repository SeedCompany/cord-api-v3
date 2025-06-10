import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ResourceLoader } from '~/core';
import { ProgressReport } from '../../dto';
import { ExecuteProgressReportTransitionInput } from '../dto/execute-progress-report-transition.input';
import { ProgressReportWorkflowService } from '../progress-report-workflow.service';

@Resolver()
export class ProgressReportExecuteTransitionResolver {
  constructor(
    private readonly workflow: ProgressReportWorkflowService,
    private readonly resources: ResourceLoader,
  ) {}

  @Mutation(() => ProgressReport)
  async transitionProgressReport(
    @Args({ name: 'input' }) input: ExecuteProgressReportTransitionInput,
  ): Promise<ProgressReport> {
    await this.workflow.executeTransition(input);
    return await this.resources.load(ProgressReport, input.report);
  }
}
