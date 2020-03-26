import { gql } from 'apollo-server-core';
import { generate, isValid } from 'shortid';
import {
  Budget,
  BudgetRecord,
  CreateBudget,
  CreateBudgetRecord,
} from '../../src/components/budget/dto';
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
        createBudgetRecord(input: $input) {
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

export async function createBudgetRecord(
  app: TestApp,
  input: Partial<CreateBudgetRecord> = {}
) {
  const budgetRecord: CreateBudgetRecord = {
    budgetId: generate(),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createBudgetRecord($input: CreateBudgetRecordInput!) {
        createBudgetRecord(input: $input) {
          budgetRecord {
            ...budgetRecord
          }
        }
      }
      ${fragments.budgetRecord}
    `,
    {
      input: {
        budgetRecord: {
          ...budgetRecord,
        },
      },
    }
  );

  const actual: BudgetRecord = result.createBudgetRecord.budgetRecord;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);

  return actual;
}
