import { type TransitionEnhancer } from '../../../workflow/define-workflow';
import { type ProjectStep as Step } from '../../dto';
import { HasEngagement } from './conditions';
import { type ResolveParams } from './dynamic-step';
import { TeamMembers } from './notifiers';

type Enhancer = TransitionEnhancer<Step, ResolveParams>;

export const ImplicitlyNotifyTeamMembers: Enhancer = (transition) => ({
  ...transition,
  notifiers: transition.notifiers.concat(TeamMembers),
});

export const ApprovalFromEarlyConversationsRequiresEngagements: Enhancer = (
  transition,
) =>
  transition.type === 'Approve' && transition.from?.has('EarlyConversations')
    ? {
        ...transition,
        conditions: transition.conditions.concat(HasEngagement),
      }
    : transition;
