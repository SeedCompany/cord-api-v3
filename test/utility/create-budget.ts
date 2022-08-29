import { generateId, isValidId } from '../../src/common';
import {
  Budget,
  BudgetRecord,
  CreateBudget,
} from '../../src/components/budget/dto';
import { Organization } from '../../src/components/organization';
import { TestApp } from './create-app';
import { fragments } from './fragments';
import { gql } from './gql-tag';

export async function listBudgets(app: TestApp) {
  const result = await app.graphql.mutate(
    gql`
      query {
        budgets(input: {}) {
          items {
            ...budget
          }
        }
      }
      ${fragments.budget}
    `
  );
  const budgets = result.budgets.items;
  expect(budgets).toBeTruthy();
  return budgets;
}

export async function readOneBudgetRecordOrganization(
  app: TestApp,
  budgetId: string
): Promise<Organization & { canRead: boolean; canEdit: boolean }> {
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
      id: budgetId,
    }
  );

  expect(actual.id).toBe(budgetId);
  expect(isValidId(actual.id)).toBe(true);
  return {
    ...actual.records[0].organization.value,
    canRead: actual.records[0].organization.canRead,
    canEdit: actual.records[0].organization.canEdit,
  };
}

export async function readBudgetRecords(
  app: TestApp,
  id: string
): Promise<BudgetRecord[]> {
  const result = await app.graphql.query(
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
  expect(result.budget.id).toBe(id);
  expect(isValidId(result.budget.id)).toBe(true);
  return result.budget.records;
}

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
