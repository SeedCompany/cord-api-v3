import { ID } from '~/common';
import {
  Project,
  ProjectStep,
  ProjectStepTransition,
  SecuredProjectStep,
} from '../../src/components/project/dto';
import { TestApp } from './create-app';
import { gql } from './gql-tag';
import { Raw } from './raw.type';

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
  to: ProjectStep,
): Promise<SecuredStep> => {
  const result = await app.graphql.mutate(
    gql`
      mutation updateProject($id: ID!, $step: ProjectStep!) {
        updateProject(input: { project: { id: $id, step: $step } }) {
          project {
            step {
              canRead
              canEdit
              value
              transitions {
                to
                type
                label
              }
            }
          }
        }
      }
    `,
    {
      id,
      step: to,
    },
  );
  return result.updateProject.project.step.transitions;
};

export const transitionNewProjectToActive = async (
  app: TestApp,
  project: Raw<Project>,
) => {
  for (const next of [
    ...stepsFromEarlyConversationToBeforeActive,
    ProjectStep.Active,
  ]) {
    await changeProjectStep(app, project.id, next);
  }
};
