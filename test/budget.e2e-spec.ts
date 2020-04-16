import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
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
import { createPartnership } from './utility/create-partnership';
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
      name:
        'Super Secret Project ' +
        faker.hacker.adjective() +
        faker.hacker.noun(),
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

  it('read one budget by id, has records as a list of recordIds', async () => {
    // create budget first
    const budget = await createBudget(app, { projectId: project.id });
    const numRecords = 4;
    await Promise.all(
      times(numRecords).map(() =>
        createBudgetRecord(app, {
          budgetId: budget.id,
          organizationId: org.id,
          fiscalYear: 2025,
        })
      )
    );

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
    expect(actual.records.length).toEqual(numRecords);
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

  it('lists budgetRecords for a budget', async () => {
    // create 4 budget records first
    const numRecords = 4;
    await Promise.all(
      times(numRecords).map(() =>
        createBudgetRecord(app, {
          budgetId: budget.id,
          organizationId: org.id,
          fiscalYear: 2025,
        })
      )
    );
    const { budgetRecords } = await app.graphql.query(gql`
      query {
        budgetRecords (input: { filter: { budgetId : "${budget.id}" }}) {
          items {
            ...budgetRecord
          }
          hasMore
          total
        }
      }
      ${fragments.budgetRecord}
    `);

    expect(budgetRecords.items.length).toBeGreaterThanOrEqual(numRecords);
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

  it('inits a budget with a budget record for each financial partner per fiscal year', async () => {
    // create array of 4 orgs
    const organizations: Organization[] = await Promise.all(
      times(4).map(() =>
        createOrganization(app, {
          name: faker.company.companyName() + ' Inc',
        })
      )
    );

    // create a project with 4 years
    const mouStart = DateTime.fromISO('2021');
    const mouEnd = DateTime.fromISO('2024');
    const project = await createProject(app, {
      name: faker.company.companyName() + ' project',
      mouStart,
      mouEnd,
    });

    await Promise.all(
      organizations.map((org) =>
        createPartnership(app, {
          projectId: project.id,
          organizationId: org.id,
          mouStart,
          mouEnd,
        })
      )
    );

    // create a new budget for that project
    const budget = await createBudget(app, { projectId: project.id });

    // get a list of all budget records on this budget
    const { budgetRecords } = await app.graphql.query(gql`
      query {
        budgetRecords (input: { filter: { budgetId : "${budget.id}" }}) {
          items {
            ...budgetRecord
          }
          hasMore
          total
        }
      }
      ${fragments.budgetRecord}
    `);

    expect(budgetRecords.items.length).toBeGreaterThanOrEqual(4);
  });
});
