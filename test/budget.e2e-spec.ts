import { gql } from 'apollo-server-core';
import { DateTime } from 'luxon';
import { isValid } from 'shortid';
import { Budget } from '../src/components/budget/dto/budget';
import {
  CreateProject,
  Project,
  ProjectType,
} from '../src/components/project/dto';
import {
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

    try {
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
    } catch (e) {
      console.error(e);
      fail();
    }
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

  it.only('delete budget', async () => {
    // create budget first
    const budget = await createBudget(app, { projectId: project.id });

    try {
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
    } catch (e) {
      console.log(e);
      fail();
    }
    try {
      await app.graphql.query(
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
    } catch (e) {
      expect(e.status).toBe(404);
    }
  });
});

describe.only('BudgetRecord e2e', () => {
  let app: TestApp;
  let project: Project;
  let budget: Budget;

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
    budget = await createBudget(app, { projectId: project.id });
  });

  afterAll(async () => {
    await app.close();
  });

  it.only('create a budgetRecord', async () => {
    const budgetRecord = await createBudgetRecord(app, { budgetId: budget.id });
    expect(budgetRecord.id).toBeDefined();
  });

  it('read one budget by id', async () => {
    // create budget first
    const budgetRecord = await createBudgetRecord(app, { budgetId: budget.id });

    try {
      const { budget: actual } = await app.graphql.query(
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
      );

      expect(actual.id).toBe(budgetRecord.id);
      expect(isValid(actual.id)).toBe(true);
      expect(actual.fiscalYear).toEqual(budgetRecord.fiscalYear);
    } catch (e) {
      console.error(e);
      fail();
    }
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

  it.only('delete budget', async () => {
    // create budget first
    const budget = await createBudget(app, { projectId: project.id });

    try {
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
    } catch (e) {
      console.log(e);
      fail();
    }
    try {
      await app.graphql.query(
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
    } catch (e) {
      expect(e.status).toBe(404);
    }
  });
});
