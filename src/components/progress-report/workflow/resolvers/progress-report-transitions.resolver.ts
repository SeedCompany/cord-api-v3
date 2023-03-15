import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, ParentIdMiddlewareAdditions, Session } from '~/common';
import { SecuredProgressReportStatus } from '../../dto';
import { ProgressReportWorkflowTransition } from '../dto/workflow-transition.dto';
import { ProgressReportWorkflowService } from '../progress-report-workflow.service';

@Resolver(SecuredProgressReportStatus)
export class ProgressReportTransitionsResolver {
  constructor(private readonly workflow: ProgressReportWorkflowService) {}

  @ResolveField(() => [ProgressReportWorkflowTransition], {
    description: 'The available statuses the report can be transitioned to.',
  })
  async transitions(
    @Parent() status: SecuredProgressReportStatus & ParentIdMiddlewareAdditions,
    @AnonSession() session: Session,
  ): Promise<ProgressReportWorkflowTransition[]> {
    if (!status.canRead || !status.value) {
      return [];
    }
    return this.workflow.getAvailableTransitions(session, status.value);
  }

  @ResolveField(() => Boolean, {
    description: stripIndent`
      Is the current user allowed to bypass transitions entirely
      and change the status to any other status?
   `,
  })
  async canBypassTransitions(
    @AnonSession() session: Session,
  ): Promise<boolean> {
    return this.workflow.canBypass(session);
  }
}
