import { gql } from 'apollo-server-core';
import { generate, isValid } from 'shortid';
import { Budget, CreateBudget } from '../../src/components/budget/dto';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createBudget(
  app: TestApp,
  input: Partial<CreateBudget> = {}
) {
  const budget: CreateBudget = {
    projectId: generate(),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createBudget($input: CreateBudgetInput!) {
        createBudget(input: $input) {
          budget {
            ...budget
          }
        }
      }
      ${fragments.budget}
    `,
    {
      input: {
        budget: {
          ...budget,
        },
      },
    }
  );

  const actual: Budget = result.createBudget.budget;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);

  return actual;
}
