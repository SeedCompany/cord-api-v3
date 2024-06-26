import { ModuleRef } from '@nestjs/core';
import { MaybeSecured } from '~/common';
import { DynamicState } from '../../../workflow/transitions/dynamic-state';
import { Project, ProjectStep, ProjectStep as Step } from '../../dto';
import { ProjectWorkflowRepository } from '../project-workflow.repository';

export interface ResolveParams {
  project: MaybeSecured<Project>;
  moduleRef: ModuleRef;
  migrationPrevStep?: ProjectStep;
}

export const BackTo = (
  ...steps: ProjectStep[]
): DynamicState<Step, ResolveParams> => ({
  description: 'Back',
  relatedStates: steps,
  async resolve({ project, moduleRef, migrationPrevStep }) {
    if (migrationPrevStep) {
      return migrationPrevStep;
    }
    const repo = moduleRef.get(ProjectWorkflowRepository);
    const found = await repo.mostRecentStep(project.id, steps);
    return found ?? steps[0] ?? ProjectStep.EarlyConversations;
  },
});

export const BackToActive = BackTo(Step.Active, Step.ActiveChangedPlan);
