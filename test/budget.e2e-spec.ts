import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';
import { CalendarDate, fiscalYears, Secured } from '../src/common';
import { Budget } from '../src/components/budget';
import { PartnershipType } from '../src/components/partnership';
import { Project } from '../src/components/project';
import {
  createBudget,
  createProject,
  createSession,
  createTestApp,
  createUser,
  fragments,
  Raw,
  TestApp,
} from './utility';
import { createPartnership } from './utility/create-partnership';

describe('Budget e2e', () => {
  let app: TestApp;
  let project: Raw<Project>;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
    project = await createProject(app);
    await createPartnership(app, {
      projectId: project.id,
      types: [PartnershipType.Funding],
      fundingType: undefined,
    });
  });

  afterAll(async () => {
    // delete the project because extra projects ruin things in our DB
    await app.graphql.mutate(
      gql`
        mutation deleteProject($id: ID!) {
          deleteProject(id: $id)
        }
      `,
      {
        id: project.id,
      }
    );
    await app.close();
  });

  it.skip('create a budget', async () => {
    const budget = await createBudget(app, { projectId: project.id });
    expect(budget.id).toBeDefined();
    const cd = (sd: Secured<string>) =>
      sd.value ? CalendarDate.fromISO(sd.value) : undefined;
    const fiscal = fiscalYears(cd(project.mouStart), cd(project.mouEnd)); // calculate the fiscalYears covered by this date range
    expect(budget.records.length).toBe(fiscal.length);
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

  it.skip('Check consistency across budget nodes', async () => {
    // create a new budget for that project
    const budget = await createBudget(app, { projectId: project.id });
    // test it has proper schema
    const result = await app.graphql.query(gql`
      query {
        checkBudgetConsistency
      }
    `);
    expect(result.checkBudgetConsistency).toBeTruthy();

    // delete budget node so next test will pass
    await app.graphql.mutate(
      gql`
        mutation deleteBudget($id: ID!) {
          deleteBudget(id: $id)
        }
      `,
      {
        id: budget.id,
      }
    );
  });
});
