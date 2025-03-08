import { DataLoaderStrategy } from '@seedcompany/data-loader';
import { ID } from '~/common';
import { LoaderFactory } from '~/core';
import { PnpExtractionResult } from './extraction-result.dto';
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
