import { gql } from 'apollo-server-core';
import { generateId, isValidId } from '../../src/common';
import { Budget, CreateBudget } from '../../src/components/budget/dto';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function readOneBudget(app: TestApp, id: string): Promise<Budget> {
  const { budget: actual } = await app.graphql.query(
    gql`
      query budget($id: ID!) {
        budget(id: $id) {
          ...budget
        }
      }
      ${fragments.budget}
    `,
    {
      id: id,
    }
  );

  expect(actual.id).toBe(id);
  expect(isValidId(actual.id)).toBe(true);
  return actual;
}

export async function createBudget(
  app: TestApp,
  input: Partial<CreateBudget> = {}
) {
  const budget: CreateBudget = {
    projectId: await generateId(),
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

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
