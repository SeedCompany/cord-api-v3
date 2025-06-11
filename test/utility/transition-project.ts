import { type ID } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import { runAsAdmin } from './login';

export type ExecuteProjectTransitionInput = InputOf<typeof TransitionProjectDoc>;
type Step = ExecuteProjectTransitionInput['bypassTo'] & {};

export const stepsFromEarlyConversationToBeforeActive: Step[] = [
  'PendingConceptApproval',
  'PrepForConsultantEndorsement',
  'PendingConsultantEndorsement',
  'PrepForFinancialEndorsement',
  'PendingFinancialEndorsement',
  'FinalizingProposal',
  'PendingRegionalDirectorApproval',
  'PendingZoneDirectorApproval',
  'PendingFinanceConfirmation',
];

export const stepsFromEarlyConversationToBeforeCompleted = [
  ...stepsFromEarlyConversationToBeforeActive,
  'Active',
  'FinalizingCompletion',
];

export const stepsFromEarlyConversationToBeforeTerminated = [
  ...stepsFromEarlyConversationToBeforeActive,
  'Active',
  'DiscussingTermination',
  'PendingTerminationApproval',
];

export const changeProjectStep = async (app: TestApp, id: ID, to: Step) => {
  const project = await transitionProject(app, { project: id, bypassTo: to });
  return project.step.transitions;
};

export const forceProjectTo = async (app: TestApp, project: ID, bypassTo: Step) =>
  await runAsAdmin(app, async () => {
    return await transitionProject(app, { project, bypassTo });
  });

export const transitionProject = async (app: TestApp, input: ExecuteProjectTransitionInput) => {
  const result = await app.graphql.mutate(TransitionProjectDoc, { input });
  return result.transitionProject;
};
const TransitionProjectDoc = graphql(`
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
`);

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
