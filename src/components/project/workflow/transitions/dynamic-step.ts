import { ModuleRef } from '@nestjs/core';
import { Promisable } from 'type-fest';
import { Project, ProjectStep, ProjectStep as Step } from '../../dto';
import { ProjectWorkflowRepository } from '../project-workflow.repository';

export interface ResolveParams {
  project: Project;
  moduleRef: ModuleRef;
}

export interface DynamicStep {
  description: string;
  resolve: (params: ResolveParams) => Promisable<ProjectStep>;
}

export const BackTo = (...steps: ProjectStep[]): DynamicStep => ({
  description: `Back to step <${steps
    .map((step) => ProjectStep.entry(step).label)
    .join(' / ')}>`,
  async resolve({ project, moduleRef }: ResolveParams) {
    const repo = moduleRef.get(ProjectWorkflowRepository);
    const found = await repo.mostRecentStep(project.id, steps);
    return found ?? steps[0] ?? ProjectStep.EarlyConversations;
  },
});

export const BackToActive = BackTo(Step.Active, Step.ActiveChangedPlan);
