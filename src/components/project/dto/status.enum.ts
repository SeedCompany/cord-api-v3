import { createUnionType, registerEnumType } from '@nestjs/graphql';
import { ProjectStep } from './step.enum';

export enum ProjectStatus {
  InDevelopment = 'InDevelopment',
  Active = 'Active',
  Terminated = 'Terminated',
  Completed = 'Completed',
  DidNotDevelop = 'DidNotDevelop',
}

registerEnumType(ProjectStatus, {
  name: 'ProjectStatus',
  description: 'A alias for a group of project steps',
});

const mapping: Record<ProjectStep, ProjectStatus> = {
  [ProjectStep.EarlyConversations]: ProjectStatus.InDevelopment,
  [ProjectStep.PendingConceptApproval]: ProjectStatus.InDevelopment,
  [ProjectStep.PrepForConsultantEndorsement]: ProjectStatus.InDevelopment,
  [ProjectStep.PendingConsultantEndorsement]: ProjectStatus.InDevelopment,
  [ProjectStep.PrepForFinancialEndorsement]: ProjectStatus.InDevelopment,
  [ProjectStep.PendingFinancialEndorsement]: ProjectStatus.InDevelopment,
  [ProjectStep.FinalizingProposal]: ProjectStatus.InDevelopment,
  [ProjectStep.PendingRegionalDirectorApproval]: ProjectStatus.InDevelopment,
  [ProjectStep.PendingZoneDirectorApproval]: ProjectStatus.InDevelopment,
  [ProjectStep.PendingFinanceConfirmation]: ProjectStatus.InDevelopment,
  [ProjectStep.OnHoldFinanceConfirmation]: ProjectStatus.InDevelopment,
  [ProjectStep.DidNotDevelop]: ProjectStatus.DidNotDevelop,
  [ProjectStep.Rejected]: ProjectStatus.DidNotDevelop,
  [ProjectStep.Active]: ProjectStatus.Active,
  [ProjectStep.ActiveChangedPlan]: ProjectStatus.Active,
  [ProjectStep.DiscussingChangeToPlan]: ProjectStatus.Active,
  [ProjectStep.PendingChangeToPlanApproval]: ProjectStatus.Active,
  [ProjectStep.PendingChangeToPlanConfirmation]: ProjectStatus.Active,
  [ProjectStep.DiscussingSuspension]: ProjectStatus.Active,
  [ProjectStep.PendingSuspensionApproval]: ProjectStatus.Active,
  [ProjectStep.Suspended]: ProjectStatus.Active,
  [ProjectStep.DiscussingReactivation]: ProjectStatus.Active,
  [ProjectStep.PendingReactivationApproval]: ProjectStatus.Active,
  [ProjectStep.DiscussingTermination]: ProjectStatus.Active,
  [ProjectStep.PendingTerminationApproval]: ProjectStatus.Active,
  [ProjectStep.FinalizingCompletion]: ProjectStatus.Active,
  [ProjectStep.Terminated]: ProjectStatus.Terminated,
  [ProjectStep.Completed]: ProjectStatus.Completed,
};

export const stepToStatus = (step: ProjectStep): ProjectStatus => mapping[step];

export const ProjectStatusOrStep = createUnionType({
  name: 'ProjectStatusOrStep',
  description: 'A project status or step',
  types: () => [ProjectStatus as any, ProjectStep as any],
});
export type ProjectStatusOrStep = ProjectStatus | ProjectStep;
