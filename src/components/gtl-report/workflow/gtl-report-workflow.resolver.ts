import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { PeriodicReportLoader } from '../../periodic-report';
import { GTLReport } from '../dto';
import {
  ExecuteGtlReportTransition,
  GtlReportWorkflowEvent,
  GtlReportWorkflowTransition,
} from './gtl-report-workflow.dto';
import { GtlReportWorkflowService } from './gtl-report-workflow.service';

@Resolver(GTLReport)
export class GtlReportWorkflowResolver {
  constructor(private readonly service: GtlReportWorkflowService) {}

  @ResolveField(() => [GtlReportWorkflowTransition], {
    description: 'Transitions available from this report’s current state',
  })
  async transitions(@Parent() report: GTLReport) {
    return await this.service.available(report.id);
  }

  @ResolveField(() => [GtlReportWorkflowEvent], {
    description: 'The report’s status history, oldest first',
  })
  async workflowEvents(@Parent() report: GTLReport) {
    return await this.service.history(report.id);
  }

  @Mutation(() => GTLReport, {
    description: 'Move a GTL report to the next state',
  })
  async executeGtlReportTransition(
    @Args('input') input: ExecuteGtlReportTransition,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ) {
    await this.service.execute(input);
    reports.clear(input.report);
    return await reports.load(input.report);
  }
}
