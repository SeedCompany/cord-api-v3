import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { GtlGoal } from '../dto';
import { GtlGoalService } from './gtl-goal.service';

@LoaderFactory(() => GtlGoal)
export class GtlGoalLoader implements DataLoaderStrategy<GtlGoal, ID<GtlGoal>> {
  constructor(private readonly service: GtlGoalService) {}

  async loadMany(ids: ReadonlyArray<ID<GtlGoal>>) {
    return await this.service.readMany(ids);
  }
}
