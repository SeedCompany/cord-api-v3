import { ID } from '~/common';
import { LoaderFactory, LoaderOptionsOf, OrderedNestDataLoader } from '~/core';
import { FetchedSummaries } from './dto';
import { ProgressSummaryRepository } from './progress-summary.repository';

@LoaderFactory()
export class ProgressSummaryLoader extends OrderedNestDataLoader<FetchedSummaries> {
  constructor(private readonly repo: ProgressSummaryRepository) {
    super();
  }

  getOptions() {
    return {
      propertyKey: (row) => row.report.id,
    } satisfies LoaderOptionsOf<ProgressSummaryLoader>;
  }

  async loadMany(ids: readonly ID[]) {
    return await this.repo.readMany(ids);
  }
}
