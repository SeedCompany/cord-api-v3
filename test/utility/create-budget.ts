import { gql } from 'apollo-server-core';
import { generateId, isValidId } from '../../src/common';
import {
  Budget,
  BudgetRecord,
  CreateBudget,
} from '../../src/components/budget/dto';
import { Organization } from '../../src/components/organization';
import { TestApp } from './create-app';
import { fragments } from './fragments';

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
  return actual.records;
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
