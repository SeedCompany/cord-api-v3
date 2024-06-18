import { TransitionEnhancer } from '../../../workflow/define-workflow';
import { ProjectStep as Step } from '../../dto';
import { ResolveParams } from './dynamic-step';
import { TeamMembers } from './notifiers';

type Enhancer = TransitionEnhancer<Step, ResolveParams>;

export const ImplicitlyNotifyTeamMembers: Enhancer = (transition) => ({
  ...transition,
  notifiers: transition.notifiers.concat(TeamMembers),
});
