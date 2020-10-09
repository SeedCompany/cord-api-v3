import { createUnionType, registerEnumType } from '@nestjs/graphql';
import { ProjectStep } from './step.enum';

export enum ProjectStatus {
  InDevelopment = 'InDevelopment',
  Active = 'Active',
  Terminated = 'Terminated',
  Completed = 'Completed',
}

registerEnumType(ProjectStatus, {
  name: 'ProjectStatus',
  description: 'A alias for a group of project steps',
});

const mapping: Record<ProjectStatus, ProjectStep[]> = {
  [ProjectStatus.InDevelopment]: [
    ProjectStep.EarlyConversations,
    ProjectStep.PendingConceptApproval,
    ProjectStep.PrepForConsultantEndorsement,
    ProjectStep.PendingConsultantEndorsement,
    ProjectStep.PrepForFinancialEndorsement,
    ProjectStep.PendingFinancialEndorsement,
    ProjectStep.FinalizingProposal,
    ProjectStep.PendingRegionalDirectorApproval,
    ProjectStep.PendingZoneDirectorApproval,
    ProjectStep.PendingFinanceConfirmation,
    ProjectStep.OnHoldFinanceConfirmation,
  ],
  [ProjectStatus.Active]: [
    ProjectStep.Active,
    ProjectStep.ActiveChangedPlan,
    ProjectStep.DiscussingChangeToPlan,
    ProjectStep.DiscussingChangeToPlan,
    ProjectStep.PendingChangeToPlanApproval,
    ProjectStep.DiscussingSuspension,
    ProjectStep.PendingSuspensionApproval,
    ProjectStep.Suspended,
    ProjectStep.DiscussingReactivation,
    ProjectStep.PendingReactivationApproval,
    ProjectStep.DiscussingTermination,
    ProjectStep.PendingTerminationApproval,
    ProjectStep.FinalizingCompletion,
  ],
  [ProjectStatus.Terminated]: [ProjectStep.Terminated],
  [ProjectStatus.Completed]: [ProjectStep.Completed],
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
