import { OnHook } from '~/core/hooks';
import { ProjectCreatedHook } from '../../project/hooks';
import { BudgetService } from '../budget.service';

@OnHook(ProjectCreatedHook)
export class CreateProjectDefaultBudgetHandler {
  constructor(private readonly budgets: BudgetService) {}

  async handle({ project }: ProjectCreatedHook) {
    await this.budgets.create({ project: project.id });
  }
}
