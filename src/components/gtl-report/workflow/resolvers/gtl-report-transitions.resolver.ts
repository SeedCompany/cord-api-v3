import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Grandparent } from '~/common';
import { SerializedWorkflow } from '../../../workflow/dto';
import { type GTLReport, SecuredGtlReportStatus } from '../../dto';
import { GtlReportWorkflowTransition } from '../dto';
import { GtlReportWorkflowService } from '../gtl-report-workflow.service';

@Resolver(SecuredGtlReportStatus)
export class GtlReportTransitionsResolver {
  constructor(private readonly workflow: GtlReportWorkflowService) {}

  @Query(() => SerializedWorkflow)
  async gtlReportWorkflow() {
    return this.workflow.serialize();
  }

  @ResolveField(() => [GtlReportWorkflowTransition], {
    description:
      'The transitions currently available to execute for this GTL report',
  })
  async transitions(
    @Grandparent() report: GTLReport,
    @Parent() status: SecuredGtlReportStatus,
  ): Promise<readonly GtlReportWorkflowTransition[]> {
    if (!status.canRead || !status.value) {
      return [];
    }
    return await this.workflow.getAvailableTransitions(report);
  }

  @ResolveField(() => Boolean, {
    description: stripIndent`
      Is the current user allowed to bypass transitions entirely
      and change to any other status?
   `,
  })
  async canBypassTransitions(): Promise<boolean> {
    return this.workflow.canBypass();
  }
}
