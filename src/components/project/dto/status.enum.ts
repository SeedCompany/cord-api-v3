import { createUnionType, registerEnumType } from '@nestjs/graphql';
import { ProjectStep } from './step.enum';

export enum ProjectStatus {
  InDevelopment = 'InDevelopment',
  Pending = 'Pending',
  Active = 'Active',
  Stopped = 'Stopped',
  Finished = 'Finished',
}

registerEnumType(ProjectStatus, {
  name: 'ProjectStatus',
  description: 'A alias for a group of project steps',
});

const mapping: Record<ProjectStatus, ProjectStep[]> = {
  [ProjectStatus.InDevelopment]: [
    ProjectStep.EarlyConversations,
    ProjectStep.PrepForConsultantEndorsement,
    ProjectStep.PrepForFinancialEndorsement,
    ProjectStep.FinalizingProposal,

    ProjectStep.PrepForGrowthPlanEndorsement,
    ProjectStep.PendingGrowthPlanEndorsement,
  ],
  [ProjectStatus.Pending]: [
    ProjectStep.PendingConceptApproval,
    ProjectStep.PendingConsultantEndorsement,
    ProjectStep.PendingFinancialEndorsement,
    ProjectStep.PendingAreaDirectorApproval,
    ProjectStep.PendingRegionalDirectorApproval,
    ProjectStep.PendingFinanceConfirmation,
    ProjectStep.OnHoldFinanceConfirmation,
  ],
  [ProjectStatus.Active]: [ProjectStep.Active],
  [ProjectStatus.Stopped]: [
    ProjectStep.Suspended,
    ProjectStep.Rejected,
    ProjectStep.Terminated,
  ],
  [ProjectStatus.Finished]: [ProjectStep.DidNotDevelop, ProjectStep.Completed],
};

export const stepToStatus = (step: ProjectStep): ProjectStatus => {
  const entries = Object.entries(mapping) as Array<
    [ProjectStatus, ProjectStep[]]
  >;
  for (const [status, steps] of entries) {
    if (steps.includes(step)) {
      return status;
    }
  }
  throw new Error(`Could not find status for given step: ${step}`);
};

export const ProjectStatusOrStep = createUnionType({
  name: 'ProjectStatusOrStep',
  description: 'A project status or step',
  types: () => [ProjectStatus as any, ProjectStep as any],
});
export type ProjectStatusOrStep = ProjectStatus | ProjectStep;
