import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory, type LoaderOptionsOf } from '~/core/data-loader';
import { type FetchedSummaries } from './dto';
import { ProgressSummaryRepository } from './progress-summary.repository';

@LoaderFactory()
export class ProgressSummaryLoader
  implements DataLoaderStrategy<FetchedSummaries, ID<'ProgressReport'>>
{
  constructor(private readonly repo: ProgressSummaryRepository) {}

  getOptions() {
    return {
      propertyKey: (row) => row.report.id,
    } satisfies LoaderOptionsOf<ProgressSummaryLoader>;
  }

  async loadMany(ids: ReadonlyArray<ID<'ProgressReport'>>) {
    return await this.repo.readMany(ids);
  }
}
