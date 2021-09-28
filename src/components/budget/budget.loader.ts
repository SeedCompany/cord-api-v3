import { Injectable, Scope } from '@nestjs/common';
import { ID, ObjectView } from '../../common';
import { ObjectViewAwareLoader } from '../../core';
import { BudgetService } from './budget.service';
import { Budget } from './dto';

@Injectable({ scope: Scope.REQUEST })
export class BudgetLoader extends ObjectViewAwareLoader<Budget> {
  constructor(private readonly budgets: BudgetService) {
    super();
  }

  async loadManyByView(ids: readonly ID[], view?: ObjectView) {
    return await this.budgets.readMany(ids, this.session, view);
  }
}
