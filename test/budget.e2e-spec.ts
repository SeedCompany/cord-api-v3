import { gql } from 'apollo-server-core';
import { times } from 'lodash';
import {
  CalendarDate,
  fiscalYears,
  isValidId,
  NotFoundException,
  Secured,
} from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { Budget } from '../src/components/budget';
import { PartnerType } from '../src/components/partner';
import { Project } from '../src/components/project';
import {
  createBudget,
  createProject,
  createSession,
  createTestApp,
  fragments,
  Raw,
  registerUserWithPower,
  TestApp,
} from './utility';
import { createPartnership } from './utility/create-partnership';

describe('Budget e2e', () => {
  let app: TestApp;
  let project: Raw<Project>;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUserWithPower(app, [
      Powers.CreateOrganization,
      Powers.CreateProject,
      Powers.CreatePartnership,
      Powers.CreateBudget,
      Powers.CreateFieldZone,
    ]);
    project = await createProject(app);
    await createPartnership(app, {
      projectId: project.id,
      types: [PartnerType.Funding],
      financialReportingType: undefined,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it.skip('create a budget', async () => {
    const budget = await createBudget(app, { projectId: project.id });
    expect(budget.id).toBeDefined();
    const cd = (sd: Secured<string | null>) =>
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
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.status).toEqual(budget.status);
  });

  it.skip('delete budget', async () => {
    // create budget first
    const budget = await createBudget(app, { projectId: project.id });

    const result = await app.graphql.mutate(
      gql`
        mutation deleteBudget($id: ID!) {
          deleteBudget(id: $id) {
            __typename
          }
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
    ).rejects.toThrowError(new NotFoundException('Could not find budget'));
  });

  it('List budget nodes', async () => {
    // create 2 budgets
    const numBudgets = 2;
    await Promise.all(
      times(numBudgets).map(() => createBudget(app, { projectId: project.id }))
    );

    const { budgets } = await app.graphql.query(
      gql`
        query budgets {
          budgets {
            items {
              ...budget
            }
            hasMore
            total
          }
        }
        ${fragments.budget}
      `,
      {}
    );

    expect(budgets.items.length).toBeGreaterThanOrEqual(numBudgets);
  });
});
