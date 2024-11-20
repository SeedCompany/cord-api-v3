import { Injectable } from '@nestjs/common';
import { ID } from '~/common';
import { PnpExtractionResult } from './extraction-result.dto';
import { PnpExtractionResultRepository } from './pnp-extraction-result.edgedb.repository';

@Injectable()
export class PlanningExtractionResultSaver {
  constructor(private readonly repo: PnpExtractionResultRepository) {}

  async save(file: ID<'FileVersion'>, result: PnpExtractionResult) {
    await this.repo.save(file, result);
  }
}
