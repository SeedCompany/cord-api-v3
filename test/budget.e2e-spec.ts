import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { DateTime } from 'luxon';
import { isValid } from 'shortid';
import { CalendarDate, fiscalYears, Secured } from '../src/common';
import { Budget } from '../src/components/budget';
import { PartnershipType } from '../src/components/partnership';
import { Project, ProjectType } from '../src/components/project';
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
    project = await createProject(app, {
      name:
        'Super Secret Project ' +
        faker.hacker.adjective() +
        faker.hacker.noun(),
      type: ProjectType.Translation,
      mouStart: DateTime.fromISO('2020-02-01'),
      mouEnd: DateTime.fromISO('2025-01-01'),
    });
    await createPartnership(app, {
      projectId: project.id,
      types: [PartnershipType.Funding],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a budget', async () => {
    const budget = await createBudget(app, { projectId: project.id });
    expect(budget.id).toBeDefined();
    const cd = (sd: Secured<string>) =>
      sd.value ? CalendarDate.fromISO(sd.value) : undefined;
    const fiscal = fiscalYears(cd(project.mouStart), cd(project.mouEnd));
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

  it('lists budget for a projectId', async () => {
    // create budget first
    // create 4 budget first
    const numBudget = 4;
    await Promise.all(
      times(numBudget).map(() => createBudget(app, { projectId: project.id }))
    );

    const { budgets } = await app.graphql.query(gql`
      query {
        budgets (input: { filter: { projectId : "${project.id}" }}) {
          items {
            ...budget
          }
          hasMore
          total
        }
      }
      ${fragments.budget}
    `);

    expect(budgets.items.length).toBeGreaterThanOrEqual(numBudget);
  });

  it('Check consistency across budget nodes', async () => {
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
