import { EventsHandler, type IEventHandler } from '~/core';
import { ProjectCreatedEvent } from '../../project/events';
import { BudgetService } from '../budget.service';

@EventsHandler(ProjectCreatedEvent)
export class CreateProjectDefaultBudgetHandler implements IEventHandler<ProjectCreatedEvent> {
  constructor(private readonly budgets: BudgetService) {}

  async handle({ project }: ProjectCreatedEvent) {
    await this.budgets.create({ project: project.id });
  }
}
