import { ObjectType } from '@nestjs/graphql';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { type ScopedRole } from '../../../authorization/dto';
import { WorkflowEvent } from '../../../workflow/dto';
import { GtlReportStatus } from '../../dto';
import { GtlReportWorkflowTransition } from './workflow-transition.dto';

@RegisterResource()
@ObjectType()
export abstract class GtlReportWorkflowEvent extends WorkflowEvent(
  GtlReportStatus,
  GtlReportWorkflowTransition,
) {
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;

  readonly report: LinkTo<'GTLReport'>;

  /**
   * The requester's project-scoped roles for the report's project. The
   * `member` policy condition reads this when securing `who` and `notes`, so
   * the repository attaches it on every read path. A per-request cache rather
   * than a stored fact, and never exposed over GraphQL.
   */
  readonly scope: readonly ScopedRole[];
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    GtlReportWorkflowEvent: typeof GtlReportWorkflowEvent;
  }
}
