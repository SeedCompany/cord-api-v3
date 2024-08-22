import { Injectable } from '@nestjs/common';
import { ID, NotImplementedException } from '~/common';
import { CommonRepository } from '~/core/edgedb';
import { PnpExtractionResult } from './extraction-result.dto';
import { PnpExtractionResultLoadResult } from './pnp-extraction-result.loader';

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
