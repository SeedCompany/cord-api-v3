import { EventsHandler, IEventHandler } from '../../../core';
import { ProjectStatus } from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { BudgetService } from '../budget.service';
import { BudgetStatus, UpdateBudget } from '../dto';

@EventsHandler(ProjectUpdatedEvent)
export class UpdateProjectBudgetStatusHandler
  implements IEventHandler<ProjectUpdatedEvent> {
  constructor(private readonly budgets: BudgetService) {}

  async handle({ project, updates: input, session }: ProjectUpdatedEvent) {
    const budgets = await this.budgets.list(
      {
        filter: {
          projectId: input.id,
        },
      },
      session
    );

    const pendingBudget = budgets.items.find(
      (b) => b.status === BudgetStatus.Pending
    );
    //574 -The pending budget should be set to active i.e Current when the project gets set to active
    const newStatus = project.status;
    if (
      (newStatus === ProjectStatus.InDevelopment ||
        newStatus === ProjectStatus.Pending) &&
      pendingBudget?.status === BudgetStatus.Pending
    ) {
      const input: UpdateBudget = {
        id: pendingBudget.id,
        status: BudgetStatus.Current,
      };

      await this.budgets.update(input, session);
    }
  }
}
