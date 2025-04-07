import { ModuleRef } from '@nestjs/core';
import { MaybeSecured } from '~/common';
import { DynamicState } from '../../../workflow/transitions/dynamic-state';
import { Project, ProjectStep, ProjectStep as Step } from '../../dto';
import { ProjectWorkflowRepository } from '../project-workflow.repository';

export interface ResolveParams {
  project: MaybeSecured<Project>;
  previousStep?: Step;
  moduleRef: ModuleRef;
  migrationPrevSteps?: ProjectStep[];
}

export const BackTo = (
  ...steps: ProjectStep[]
): DynamicState<Step, ResolveParams> => ({
  description: 'Back',
  relatedStates: steps,
  async resolve({ project, moduleRef, migrationPrevSteps }) {
    if (migrationPrevSteps) {
      return migrationPrevSteps.find((s) => steps.includes(s)) ?? steps[0];
    }
    const repo = moduleRef.get(ProjectWorkflowRepository);
    const found = await repo.mostRecentStep(project.id, steps);
    return found ?? steps[0] ?? ProjectStep.EarlyConversations;
  },
});

export const BackToActive = BackTo(Step.Active, Step.ActiveChangedPlan);
