import { setOf } from '@seedcompany/common';
import { ProjectStep as Step } from '../../../project/dto';
import { TransitionCondition } from '../../../workflow/transitions/conditions';
import { EngagementWorkflowContext } from './context';

type Condition = TransitionCondition<EngagementWorkflowContext>;

export const ProjectStep = (...steps: Step[]): Condition => {
  const stepSet = setOf(steps);
  const description =
    'Project needs to be ' +
    [...stepSet].map((step) => Step.entry(step).label).join(' / ');
  return {
    description,
    resolve({ engagement, migrationPrevStates }) {
      if (migrationPrevStates) {
        // Skip for migration, since it is easier and not applicable for historic data in current use.
        return { status: 'ENABLED' };
      }
      return {
        status: steps.includes(engagement.project.step)
          ? 'ENABLED'
          : 'DISABLED',
        disabledReason: description,
      };
    },
  };
};
