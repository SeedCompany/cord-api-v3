import { ConfigService } from '~/core/config';
import { OnHook } from '~/core/hooks';
import { ProjectStatus, stepToStatus } from '../../project/dto';
import { ProjectTransitionedHook } from '../../project/workflow/hooks/project-transitioned.hook';
import { BudgetService } from '../budget.service';
import { BudgetStatus } from '../dto';

@OnHook(ProjectTransitionedHook)
export class UpdateProjectBudgetStatusHandler {
  constructor(
    private readonly budgets: BudgetService,
    private readonly config: ConfigService,
  ) {}

  async handle(event: ProjectTransitionedHook) {
    // migration-todo: Budget isn't migrated to Postgres yet; skip this
    // Neo4j-only budget-status sync under DATABASE=postgres. Drop this guard
    // when budget-pg lands.
    if (this.config.databaseEngine === 'postgres') return;
    const { project } = event;

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

    const budgets = await this.budgets.list({
      filter: {
        projectId: project.id,
      },
    });

    const budget = budgets.items.find((b) => b.status === change[0]);
    if (!budget) {
      return;
    }

    await this.budgets.update({ id: budget.id, status: change[1] });
  }
}
