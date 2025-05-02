import { Injectable } from '@nestjs/common';
import { type ID, NotImplementedException } from '~/common';
import { CommonRepository } from '~/core/gel';
import { type PnpExtractionResult } from './extraction-result.dto';
import { type PnpExtractionResultLoadResult } from './pnp-extraction-result.loader';

@Injectable()
export class PnpExtractionResultRepository extends CommonRepository {
  async read(
    files: ReadonlyArray<ID<'File'>>,
  ): Promise<readonly PnpExtractionResultLoadResult[]> {
    throw new NotImplementedException().with(files);
  }

  async save(
    file: ID<'FileVersion'>,
    result: PnpExtractionResult,
  ): Promise<void> {
    throw new NotImplementedException().with(file, result);
  }
}
