import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '~/common';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import { WorkflowEvent } from '../../../workflow/dto';
import { EngagementStatus, IEngagement } from '../../dto';
import { EngagementWorkflowTransition } from './engagement-workflow-transition.dto';

@RegisterResource({ db: e.Engagement.WorkflowEvent })
@ObjectType()
export abstract class EngagementWorkflowEvent extends WorkflowEvent(
  EngagementStatus,
  EngagementWorkflowTransition,
) {
  static readonly Props = keysOf<EngagementWorkflowEvent>();
  static readonly SecuredProps =
    keysOf<SecuredProps<EngagementWorkflowEvent>>();
  static readonly BaseNodeProps = WorkflowEvent.BaseNodeProps;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;

  readonly engagement: Pick<IEngagement, 'id'>;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    EngagementWorkflowEvent: typeof EngagementWorkflowEvent;
  }
  interface ResourceDBMap {
    EngagementWorkflowEvent: typeof e.Engagement.WorkflowEvent;
  }
}
