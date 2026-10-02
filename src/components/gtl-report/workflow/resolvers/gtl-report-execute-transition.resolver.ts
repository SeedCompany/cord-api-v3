import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { type ID } from '~/common';
import { ResourceLoader } from '~/core/resources';
import { PeriodicReportLoader } from '../../../periodic-report';
import { type IPeriodicReport } from '../../../periodic-report/dto';
import { GTLReport } from '../../dto';
import { ExecuteGtlReportTransition } from '../dto';
import { GtlReportWorkflowService } from '../gtl-report-workflow.service';

@Resolver()
export class GtlReportExecuteTransitionResolver {
  constructor(
    private readonly workflow: GtlReportWorkflowService,
    private readonly resources: ResourceLoader,
  ) {}

  @Mutation(() => GTLReport)
  async transitionGtlReport(
    @Args('input') input: ExecuteGtlReportTransition,
  ): Promise<GTLReport> {
    await this.workflow.executeTransition(input);
    // The report may already sit in this request's loader from before the
    // write; drop it so the returned report carries the new status.
    const reports = await this.resources.getLoader(PeriodicReportLoader);
    reports.clear(input.report as ID<IPeriodicReport>);
    return await this.resources.load(GTLReport, input.report);
  }
}
