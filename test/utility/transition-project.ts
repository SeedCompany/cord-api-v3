import { gql } from 'apollo-server-core';
import {
  ProjectStep,
  ProjectStepTransition,
  SecuredProjectStep,
} from '../../src/components/project/dto';
import { TestApp } from './create-app';

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

type SecuredStep = SecuredProjectStep & {
  transitions: ProjectStepTransition[];
};

export const changeProjectStep = async (
  app: TestApp,
  id: string,
  to: ProjectStep
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
    }
  );
  return result.updateProject.project.step.transitions;
};
