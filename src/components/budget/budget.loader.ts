import { ID, ObjectView } from '../../common';
import { LoaderFactory, ObjectViewAwareLoader } from '../../core';
import { BudgetService } from './budget.service';
import { Budget } from './dto';

@LoaderFactory(() => Budget)
export class BudgetLoader extends ObjectViewAwareLoader<Budget> {
  constructor(private readonly budgets: BudgetService) {
    super();
  }

  async loadManyByView(ids: readonly ID[], view?: ObjectView) {
    return await this.budgets.readMany(ids, this.session, view);
  }
}
