import { gql } from 'apollo-server-express';
import * as faker from 'faker';
import { isValid } from 'shortid';
import { CreateWorkflow, Workflow } from '../../src/components/workflow/dto';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createWorkflow(
  app: TestApp,
  input: Partial<CreateWorkflow> = {}
) {
  // in this test, we will use organization as a baseNode
  const workflow: CreateWorkflow = {
    baseNodeId: input.baseNodeId!,
    startingStateName: faker.company.companyName() + ' WF',
    stateIdentifier: faker.lorem.word(),
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createWorkflow($input: CreateWorkflowInput!) {
        createWorkflow(input: $input) {
          workflow {
            ...workflow
          }
        }
      }
      ${fragments.workflow}
    `,
    {
      input: {
        workflow,
      },
    }
  );

  const actual: Workflow = result.createWorkflow.workflow;
  expect(actual).toBeTruthy();
  expect(isValid(actual.id)).toBe(true);
  expect(actual.stateIdentifier).toBe(workflow.stateIdentifier);
  expect(actual.startingState.id).toBeTruthy();
  expect(actual.startingState.value).toBe(workflow.startingStateName);

  return actual;
}
