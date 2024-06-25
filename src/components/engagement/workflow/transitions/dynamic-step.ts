import { ModuleRef } from '@nestjs/core';
import { DynamicState } from '../../../workflow/transitions/dynamic-state';
import {
  Engagement,
  EngagementStatus,
  EngagementStatus as Step,
} from '../../dto';
import { EngagementWorkflowRepository } from '../engagement-workflow.repository';

export interface ResolveEngagementParams {
  engagement: Engagement;
  moduleRef: ModuleRef;
  migrationPrevStep?: EngagementStatus;
}

export const BackTo = (
  ...steps: EngagementStatus[]
): DynamicState<Step, ResolveEngagementParams> => ({
  description: 'Back',
  relatedStates: steps,
  async resolve({ engagement, moduleRef, migrationPrevStep }) {
    if (migrationPrevStep) {
      return migrationPrevStep;
    }
    const repo = moduleRef.get(EngagementWorkflowRepository);
    const found = await repo.mostRecentStep(engagement.id, steps);
    return found ?? steps[0] ?? EngagementStatus.InDevelopment;
  },
});

export const BackToActive = BackTo(Step.Active, Step.ActiveChangedPlan);
