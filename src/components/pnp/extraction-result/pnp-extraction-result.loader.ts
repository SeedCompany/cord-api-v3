import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { type PnpExtractionResult } from './extraction-result.dto';
import { PnpExtractionResultRepository } from './pnp-extraction-result.gel.repository';

export interface PnpExtractionResultLoadResult {
  id: ID<'File'>;
  result: PnpExtractionResult | null;
}

@LoaderFactory()
export class PnpExtractionResultLoader
  implements DataLoaderStrategy<PnpExtractionResultLoadResult, ID<'File'>>
{
  constructor(private readonly repo: PnpExtractionResultRepository) {}

  async loadMany(files: ReadonlyArray<ID<'File'>>) {
    return await this.repo.read(files);
  }
}
