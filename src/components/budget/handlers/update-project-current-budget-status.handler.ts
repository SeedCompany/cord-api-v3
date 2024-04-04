import { EventsHandler, IEventHandler } from '~/core';
import { ProjectStatus, stepToStatus } from '../../project/dto';
import { ProjectUpdatedEvent } from '../../project/events';
import { BudgetService } from '../budget.service';
import { BudgetStatus } from '../dto';

@EventsHandler(ProjectUpdatedEvent)
export class UpdateProjectBudgetStatusHandler
  implements IEventHandler<ProjectUpdatedEvent>
{
  constructor(private readonly budgets: BudgetService) {}

  async handle({ previous, updates, session }: ProjectUpdatedEvent) {
    // Continue if project just became active
    if (!updates.step) {
      return;
    }
    let budgetStatus: BudgetStatus = BudgetStatus.Current;
    if (
      stepToStatus(updates.step) !== ProjectStatus.Active ||
      previous.status === ProjectStatus.Active
    ) {
      // If Project status became In Dev from Active
      if (
        previous.status === ProjectStatus.Active &&
        stepToStatus(updates.step) === ProjectStatus.InDevelopment
      ) {
        budgetStatus = BudgetStatus.Pending;
      } else {
        return;
      }
    }

    const budgets = await this.budgets.list(
      {
        filter: {
          projectId: previous.id,
        },
      },
      session,
    );

    const budget = budgets.items.find(
      (b) =>
        b.status ===
        (budgetStatus === BudgetStatus.Current
          ? BudgetStatus.Pending
          : BudgetStatus.Current),
    );
    if (!budget) {
      // no pending or current budget, nothing to do
      return;
    }

    // Set pending budget to current, now that the project is active
    await this.budgets.update({ id: budget.id, status: budgetStatus }, session);
  }
}
