import { EventsHandler, IEventHandler } from '../../../core';
import { ProjectStatus, stepToStatus } from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { BudgetService } from '../budget.service';
import { BudgetStatus } from '../dto';

@EventsHandler(ProjectUpdatedEvent)
export class UpdateProjectBudgetStatusHandler
  implements IEventHandler<ProjectUpdatedEvent> {
  constructor(private readonly budgets: BudgetService) {}

  async handle({ previous, updates, session }: ProjectUpdatedEvent) {
    // Continue if project just became active
    if (
      !updates.step ||
      stepToStatus(updates.step) !== ProjectStatus.Active ||
      previous.status === ProjectStatus.Active
    ) {
      return;
    }

    const budgets = await this.budgets.list(
      {
        filter: {
          projectId: previous.id,
        },
      },
      session
    );

    const budget = budgets.items.find((b) => b.status === BudgetStatus.Pending);
    if (!budget) {
      // no pending budget, nothing to do
      return;
    }

    // Set pending budget to current, now that the project is active
    await this.budgets.update(
      { id: budget.id, status: BudgetStatus.Current },
      session
    );
  }
}
