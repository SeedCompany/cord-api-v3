import { ID } from '../../src/common';
import {
  ProjectStep,
  ProjectStepTransition,
  SecuredProjectStep,
} from '../../src/components/project/dto';
import { TestApp } from './create-app';
import { createTransitionProject } from './create-transition-project';

export const stepsFromEarlyConversationToBeforeActive = [
  ProjectStep.PendingConceptApproval,
  ProjectStep.PrepForConsultantEndorsement,
  ProjectStep.PendingConsultantEndorsement,
  ProjectStep.PrepForFinancialEndorsement,
  ProjectStep.PendingFinancialEndorsement,
  ProjectStep.FinalizingProposal,
  ProjectStep.PendingRegionalDirectorApproval,
  ProjectStep.PendingZoneDirectorApproval,
  ProjectStep.PendingFinanceConfirmation,
];

export const stepsFromEarlyConversationToBeforeCompleted = [
  ...stepsFromEarlyConversationToBeforeActive,
  ProjectStep.Active,
  ProjectStep.FinalizingCompletion,
];

export const stepsFromEarlyConversationToBeforeTerminated = [
  ...stepsFromEarlyConversationToBeforeActive,
  ProjectStep.Active,
  ProjectStep.DiscussingTermination,
  ProjectStep.PendingTerminationApproval,
];

type SecuredStep = SecuredProjectStep & {
  transitions: ProjectStepTransition[];
};

export const changeProjectStep = async (
  app: TestApp,
  id: ID,
  to: ProjectStep
): Promise<SecuredStep> => {
  const project = await createTransitionProject(app, {
    id: id,
    step: to,
  });
  return project.step.transitions;
};
