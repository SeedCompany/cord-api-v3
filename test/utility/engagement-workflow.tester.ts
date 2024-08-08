import { ID } from '~/common';
import { IEngagement } from '../../src/components/engagement/dto';
import {
  EngagementWorkflowTransition,
  ExecuteEngagementTransitionInput,
} from '../../src/components/engagement/workflow/dto';
import { EngagementWorkflow } from '../../src/components/engagement/workflow/engagement-workflow';
import { TestApp } from './create-app';
import { gql } from './gql-tag';
import { Raw } from './raw.type';
import { WorkflowTester } from './workflow.tester';

export class EngagementWorkflowTester extends WorkflowTester<
  typeof EngagementWorkflow
> {
  static async for(app: TestApp, id: ID) {
    const { status: initial } = await EngagementWorkflowTester.getState(
      app,
      id,
    );
    return new EngagementWorkflowTester(app, id, initial.value!);
  }

  protected async fetchTransitions() {
    const eng = await EngagementWorkflowTester.getState(this.app, this.id);
    return eng.status.transitions;
  }

  protected async doExecute(input: ExecuteEngagementTransitionInput) {
    const result = await this.app.graphql.mutate(
      gql`
        mutation TransitionEngagement(
          $input: ExecuteEngagementTransitionInput!
        ) {
          transitionEngagement(input: $input) {
            status {
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
          }
        }
      `,
      { input },
    );
    const res = await (result.transitionEngagement as ReturnType<
      (typeof EngagementWorkflowTester)['getState']
    >);
    return {
      state: res.status.value!,
      transitions: res.status.transitions,
    };
  }

  static async getState(app: TestApp, id: ID) {
    const result = await app.graphql.query(
      gql`
        query EngagementTransitions($engagement: ID!) {
          engagement(id: $engagement) {
            status {
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
            statusModifiedAt {
              value
            }
          }
        }
      `,
      { engagement: id },
    );
    return result.engagement as Raw<
      Pick<IEngagement, 'status' | 'statusModifiedAt'> & {
        status: { transitions: EngagementWorkflowTransition[] };
      }
    >;
  }
}
