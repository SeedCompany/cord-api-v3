import { ConfigService } from '~/core/config';
import { OnHook } from '~/core/hooks';
import { ProjectCreatedHook } from '../../project/hooks';
import { BudgetService } from '../budget.service';

@OnHook(ProjectCreatedHook)
export class CreateProjectDefaultBudgetHandler {
  constructor(
    private readonly budgets: BudgetService,
    private readonly config: ConfigService,
  ) {}

  async handle({ project }: ProjectCreatedHook) {
    // migration-todo: Budget isn't migrated to Postgres yet; skip the
    // Neo4j-only default-budget creation under DATABASE=postgres. Drop this
    // guard when budget-pg lands.
    if (this.config.databaseEngine === 'postgres') return;
    await this.budgets.create({ project: project.id });
  }
}
