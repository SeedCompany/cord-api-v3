import { gql } from 'apollo-server-core';
import { DateTime } from 'luxon';
import { isValid } from 'shortid';
import { Budget, BudgetRecord } from '../src/components/budget/dto/budget';
import { Organization } from '../src/components/organization/dto';
import {
  CreateProject,
  Project,
  ProjectType,
} from '../src/components/project/dto';
import {
  createOrganization,
  createSession,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';
import { createBudget, createBudgetRecord } from './utility/create-budget';
import { createProject } from './utility/create-project';

describe('Budget e2e', () => {
  let app: TestApp;
  let project: Project;
  let budget: Budget;
  let org: Organization;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
    const projectInput: CreateProject = {
      name: 'Super Secret Project',
      type: ProjectType.Translation,
      mouStart: DateTime.fromISO('2020-02-01'),
      mouEnd: DateTime.fromISO('2025-01-01'),
    };
    project = await createProject(app, projectInput);
    org = await createOrganization(app);
    budget = await createBudget(app, { projectId: project.id });
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a budget', async () => {
    const budget = await createBudget(app, { projectId: project.id });
    expect(budget.id).toBeDefined();
  });

  it('read one budget by id', async () => {
    // create budget first
    const budget = await createBudget(app, { projectId: project.id });

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
        id: budget.id,
      }
    );

    expect(actual.id).toBe(budget.id);
    expect(isValid(actual.id)).toBe(true);
    expect(actual.status).toEqual(budget.status);
  });

  it('update budget', async () => {
    const budgetStatusNew = 'Current';

    // create budget first
    const budget = await createBudget(app, { projectId: project.id });

    const result = await app.graphql.mutate(
      gql`
        mutation updateBudget($input: UpdateBudgetInput!) {
          updateBudget(input: $input) {
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
            id: budget.id,
            status: budgetStatusNew,
          },
        },
      }
    );
    const updated = result.updateBudget.budget;
    expect(updated).toBeTruthy();
    expect(updated.id).toBe(budget.id);
    expect(updated.status).toBe(budgetStatusNew);
  });

  it('delete budget', async () => {
    // create budget first
    const budget = await createBudget(app, { projectId: project.id });

    const result = await app.graphql.mutate(
      gql`
        mutation deleteBudget($id: ID!) {
          deleteBudget(id: $id)
        }
      `,
      {
        id: budget.id,
      }
    );
    const actual: Budget | undefined = result.deleteBudget;
    expect(actual).toBeTruthy();

    await expect(
      app.graphql.query(
        gql`
          query budget($id: ID!) {
            budget(id: $id) {
              ...budget
            }
          }
          ${fragments.budget}
        `,
        {
          id: budget.id,
        }
      )
    ).rejects.toThrowError();
  });

  it('create a budgetRecord', async () => {
    const budgetRecord = await createBudgetRecord(app, {
      budgetId: budget.id,
      organizationId: org.id,
      fiscalYear: 2025,
    });
    expect(budgetRecord.id).toBeDefined();
  });

  it('read one budget by id', async () => {
    // create budget first
    const br = await createBudgetRecord(app, {
      budgetId: budget.id,
      organizationId: org.id,
      fiscalYear: 2025,
    });

    const { budgetRecord: actual } = await app.graphql.query(
      gql`
        query budgetRecord($id: ID!) {
          budgetRecord(id: $id) {
            ...budgetRecord
          }
        }
        ${fragments.budgetRecord}
      `,
      {
        id: br.id,
      }
    );

    expect(actual.id).toBe(br.id);
    expect(isValid(actual.id)).toBe(true);
    expect(actual.fiscalYear).toEqual(br.fiscalYear);
  });

  it('update budgetRecord', async () => {
    const amount = 200;

    // create budget first
    const budgetRecord = await createBudgetRecord(app, {
      budgetId: budget.id,
      organizationId: org.id,
      fiscalYear: 2025,
    });

    const result = await app.graphql.mutate(
      gql`
        mutation updateBudgetRecord($input: UpdateBudgetRecordInput!) {
          updateBudgetRecord(input: $input) {
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
            id: budgetRecord.id,
            amount,
          },
        },
      }
    );
    const updated = result.updateBudgetRecord.budgetRecord;

    expect(updated).toBeTruthy();
    expect(updated.id).toBe(budgetRecord.id);
    expect(updated.amount.value).toBe(amount);
  });

  it('delete budget record', async () => {
    // create budget first
    const budgetRecord = await createBudgetRecord(app, {
      budgetId: budget.id,
      organizationId: org.id,
      fiscalYear: 2025,
    });

    const result = await app.graphql.mutate(
      gql`
        mutation deleteBudgetRecord($id: ID!) {
          deleteBudgetRecord(id: $id)
        }
      `,
      {
        id: budgetRecord.id,
      }
    );
    const actual: BudgetRecord | undefined = result.deleteBudgetRecord;
    expect(actual).toBeTruthy();

    await expect(
      app.graphql.query(
        gql`
          query budgetRecord($id: ID!) {
            budgetRecord(id: $id) {
              ...budgetRecord
            }
          }
          ${fragments.budgetRecord}
        `,
        {
          id: budgetRecord.id,
        }
      )
    ).rejects.toThrowError();
  });
});
