import { EventsHandler, IEventHandler } from '~/core';
import { ProjectCreatedEvent } from '../../project/events';
import { BudgetService } from '../budget.service';

@EventsHandler(ProjectCreatedEvent)
export class CreateProjectDefaultBudgetHandler
  implements IEventHandler<ProjectCreatedEvent>
{
  constructor(private readonly budgets: BudgetService) {}

  async handle({ project, session }: ProjectCreatedEvent) {
    await this.budgets.create({ projectId: project.id }, session);
  }
}
