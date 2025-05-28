import { type ID } from '~/common';
import { graphql } from '~/graphql';
import { ProjectStep } from '../../src/components/project/dto';
import { type ExecuteProjectTransitionInput } from '../../src/components/project/workflow/dto';
import { type TestApp } from './create-app';
import { runAsAdmin } from './login';

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

export const changeProjectStep = async (
  app: TestApp,
  id: ID,
  to: ProjectStep,
) => {
  const project = await transitionProject(app, { project: id, bypassTo: to });
  return project.step.transitions;
};

export const forceProjectTo = async (
  app: TestApp,
  project: ID,
  bypassTo: ProjectStep,
) =>
  await runAsAdmin(app, async () => {
    return await transitionProject(app, { project, bypassTo });
  });

export const transitionProject = async (
  app: TestApp,
  input: ExecuteProjectTransitionInput,
) => {
  const result = await app.graphql.mutate(
    graphql(`
      mutation TransitionProject($input: ExecuteProjectTransitionInput!) {
        transitionProject(input: $input) {
          step {
            canRead
            canEdit
            value
            transitions {
              key
              label
              to
              type
              disabled
              disabledReason
            }
          }
          status
        }
      }
    `),
    { input },
  );
  return result.transitionProject;
};

export const getProjectTransitions = async (app: TestApp, project: ID) => {
  const result = await app.graphql.mutate(
    graphql(`
      query ProjectTransitions($project: ID!) {
        project(id: $project) {
          step {
            canRead
            canEdit
            value
            transitions {
              key
              label
              to
              type
              disabled
              disabledReason
            }
          }
          status
        }
      }
    `),
    { project },
  );
  return result.project;
};
