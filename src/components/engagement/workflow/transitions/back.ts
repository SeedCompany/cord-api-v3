import { DynamicState } from '../../../workflow/transitions/dynamic-state';
import { EngagementStatus, EngagementStatus as Step } from '../../dto';
import { EngagementWorkflowRepository } from '../engagement-workflow.repository';
import { EngagementWorkflowContext } from './context';

export const BackTo = (
  ...states: EngagementStatus[]
): DynamicState<Step, EngagementWorkflowContext> => ({
  description: 'Back',
  relatedStates: states,
  async resolve({ engagement, moduleRef, migrationPrevStates }) {
    if (migrationPrevStates) {
      return migrationPrevStates.find((s) => states.includes(s)) ?? states[0];
    }
    const repo = moduleRef.get(EngagementWorkflowRepository);
    const found = await repo.mostRecentStep(engagement.id, states);
    return found ?? states[0] ?? EngagementStatus.InDevelopment;
  },
});

export const BackToActive = BackTo(Step.Active, Step.ActiveChangedPlan);
