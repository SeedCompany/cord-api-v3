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
  createProject,
  createSession,
  createTestApp,
  fragments,
  TestApp,
} from './utility';
import { createBudget } from './utility/create-budget';

describe('Budget e2e', () => {
  let app: TestApp;
  let project: Project;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
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

  it.only('create a budget', async () => {
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
    expect(updated.status.value).toBe(budgetStatusNew);
  });

  it('delete budget', async () => {
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
  });
});
