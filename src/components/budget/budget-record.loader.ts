import { ID, NotFoundException, ObjectView } from '../../common';
import { LoaderFactory, ObjectViewAwareLoader } from '../../core';
import { BudgetService } from './budget.service';
import { BudgetRecord } from './dto';

/**
 * This is really here to allow BudgetRecords to have a loader.
 * This really should be updated to have a database query to fetch multiple records at once.
 * I believe the hold up there is needing project info which could be different
 * per record. All possible just a complicated query.
 */
@LoaderFactory(() => BudgetRecord)
export class BudgetRecordLoader extends ObjectViewAwareLoader<BudgetRecord> {
  constructor(private readonly budgets: BudgetService) {
    super();
  }

  async loadOne(id: ID, view?: ObjectView): Promise<BudgetRecord> {
    return await this.budgets.readOneRecord(id, this.session, view);
  }

  // Below is the same logic as SingleItemLoader

  getOptions() {
    return { ...super.getOptions(), batch: false };
  }

  async loadManyByView(ids: readonly ID[], view?: ObjectView) {
    const items = await Promise.all(
      ids.map(async (id): Promise<BudgetRecord | readonly []> => {
        try {
          return await this.loadOne(id, view);
        } catch (e) {
          if (e instanceof NotFoundException) {
            return [] as const;
          }
          throw e;
        }
      })
    );
    return items.flat();
  }
}
