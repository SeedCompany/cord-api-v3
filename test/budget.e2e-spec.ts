import { beforeAll, describe, expect, it } from '@jest/globals';
import { type ID, Role } from '~/common';
import { graphql } from '~/graphql';
import { BudgetStatus } from '../src/components/budget/dto';
import { PartnerType } from '../src/components/partner/dto';
import {
  createFundingAccount,
  createLocation,
  createPartnership,
  createProject,
  createSession,
  createTestApp,
  fragments,
  registerUser,
  runAsAdmin,
  type TestApp,
  updateProject,
} from './utility';
import { forceProjectTo } from './utility/transition-project';

describe('Budget e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [Role.FieldOperationsDirector, Role.Controller],
    });
  });

  const readBudget = async (projectId: ID) => {
    const result = await app.graphql.query(ProjectBudgetDoc, {
      id: projectId,
    });
    return result.project.budget.value!;
  };

  it('first budget starts Pending with no records', async () => {
    const project = await createProject(app);
    const budget = await readBudget(project.id);
    expect(budget.status).toBe(BudgetStatus.Pending);
    expect(budget.records.length).toBe(0);
  });

  it('funding partnership syncs records per fiscal year; project mou change resyncs', async () => {
    const project = await createProject(app);
    // No mou overrides — the partnership inherits the project's mou window
    // (1991-01-01 → 1992-01-01 from the createProject defaults), so the
    // ProjectUpdatedHook resync path is what's under test here.
    await createPartnership(app, {
      project: project.id,
      types: [PartnerType.Funding, PartnerType.Managing],
      mouStartOverride: null,
      mouEndOverride: null,
    });

    let budget = await readBudget(project.id);
    expect(
      budget.records
        .map((record) => record.fiscalYear.value)
        .sort((yearA, yearB) => yearA! - yearB!),
    ).toEqual([1991, 1992]);

    await runAsAdmin(app, async () => {
      await updateProject(app, { id: project.id, mouEnd: '1993-01-01' });
    });

    budget = await readBudget(project.id);
    expect(
      budget.records
        .map((record) => record.fiscalYear.value)
        .sort((yearA, yearB) => yearA! - yearB!),
    ).toEqual([1991, 1992, 1993]);
  });

  it('updateBudgetRecord sets the amount', async () => {
    const project = await createProject(app);
    await createPartnership(app, {
      project: project.id,
      types: [PartnerType.Funding, PartnerType.Managing],
      mouStartOverride: null,
      mouEndOverride: null,
    });
    const budget = await readBudget(project.id);
    const record = budget.records[0]!;

    const result = await runAsAdmin(app, async () => {
      return await app.graphql.mutate(UpdateBudgetRecordDoc, {
        input: { id: record.id, amount: 1234.56 },
      });
    });
    expect(result.updateBudgetRecord.budgetRecord.amount.value).toBe(1234.56);

    const updated = await readBudget(project.id);
    const updatedRecord = updated.records.find(
      (candidate) => candidate.id === record.id,
    )!;
    expect(updatedRecord.amount.value).toBe(1234.56);
  });

  it('flips the budget to Current when the project activates', async () => {
    await runAsAdmin(app, async () => {
      const fundingAccount = await createFundingAccount(app);
      const location = await createLocation(app, {
        fundingAccount: fundingAccount.id,
      });
      const project = await createProject(app, {
        primaryLocation: location.id,
      });

      const {
        step: { transitions },
      } = await forceProjectTo(app, project.id, 'PendingFinanceConfirmation');

      const { transitionProject } = await app.graphql.mutate(
        TransitionToActiveDoc,
        {
          input: {
            project: project.id,
            transition: transitions.find(
              (transition) => transition.to === 'Active',
            )?.key,
          },
        },
      );
      const activated = transitionProject.project;

      expect(activated.budget.value!.status).toBe(BudgetStatus.Current);
      // Department ID allocation rides the same transition — the project →
      // location → funding account → block chain.
      expect(activated.departmentId.value).toContain(
        fundingAccount.accountNumber.value?.toString(),
      );
    });
  });
});

const ProjectBudgetDoc = graphql(
  `
    query projectBudget($id: ID!) {
      project(id: $id) {
        budget {
          canRead
          canEdit
          value {
            ...budget
          }
        }
      }
    }
  `,
  [fragments.budget],
);

const UpdateBudgetRecordDoc = graphql(
  `
    mutation updateBudgetRecord($input: UpdateBudgetRecord!) {
      updateBudgetRecord(input: $input) {
        budgetRecord {
          ...budgetRecord
        }
      }
    }
  `,
  [fragments.budgetRecord],
);

const TransitionToActiveDoc = graphql(`
  mutation transitionProjectToActive($input: ExecuteProjectTransition!) {
    transitionProject(input: $input) {
      project {
        departmentId {
          value
        }
        budget {
          value {
            status
          }
        }
      }
    }
  }
`);
