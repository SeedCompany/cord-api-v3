import { gql } from 'apollo-server-express';
import * as faker from 'faker';
import { isValid } from 'shortid';
import { AddState, State } from '../../src/components/workflow/dto';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function addState(app: TestApp, input: Partial<AddState> = {}) {
  const state: AddState = {
    workflowId: input.workflowId!,
    stateName: faker.company.companyName() + ' ST',
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation addState($input: AddStateInput!) {
        addState(input: $input) {
          state {
            ...state
          }
        }
      }
      ${fragments.state}
    `,
    {
      input: {
        state,
      },
    }
  );

  const actual: State = result.addState.state;
  expect(actual).toBeTruthy();
  expect(isValid(actual.id)).toBe(true);
  expect(actual.value).toBe(state.stateName);

  return actual;
}
