import { EventsHandler, IEventHandler } from '~/core';
import { ProjectStatus, stepToStatus } from '../../project/dto';
import { ProjectTransitionedEvent } from '../../project/workflow/events/project-transitioned.event';
import { BudgetService } from '../budget.service';
import { BudgetStatus } from '../dto';

@EventsHandler(ProjectTransitionedEvent)
export class UpdateProjectBudgetStatusHandler
  implements IEventHandler<ProjectTransitionedEvent>
{
  constructor(private readonly budgets: BudgetService) {}

  async handle(event: ProjectTransitionedEvent) {
    const { project, session } = event;

    const prevStatus = stepToStatus(event.previousStep);
    const nextStatus = stepToStatus(event.workflowEvent.to);

    let change: [from: BudgetStatus, to: BudgetStatus] | undefined;
    if (
      prevStatus === ProjectStatus.InDevelopment &&
      nextStatus === ProjectStatus.Active
    ) {
      change = [BudgetStatus.Pending, BudgetStatus.Current];
    } else if (
      prevStatus === ProjectStatus.Active &&
      nextStatus === ProjectStatus.InDevelopment
    ) {
      change = [BudgetStatus.Current, BudgetStatus.Pending];
    }
    if (!change) {
      return;
    }

    const budgets = await this.budgets.list(
      {
        filter: {
          projectId: project.id,
        },
      },
      session,
    );

    const budget = budgets.items.find((b) => b.status === change![0]);
    if (!budget) {
      return;
    }

    await this.budgets.update({ id: budget.id, status: change[1] }, session);
  }
}
