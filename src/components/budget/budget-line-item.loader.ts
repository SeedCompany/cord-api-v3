import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { BudgetLineItemService } from './budget-line-item.service';
import { BudgetLineItem } from './dto';

@LoaderFactory(() => BudgetLineItem)
export class BudgetLineItemLoader implements DataLoaderStrategy<
  BudgetLineItem,
  ID<BudgetLineItem>
> {
  constructor(private readonly service: BudgetLineItemService) {}

  async loadMany(ids: ReadonlyArray<ID<BudgetLineItem>>) {
    return await this.service.readMany(ids);
  }
}
