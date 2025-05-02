import { Injectable } from '@nestjs/common';
import { type ID } from '~/common';
import { type PnpExtractionResult } from './extraction-result.dto';
import { PnpExtractionResultRepository } from './pnp-extraction-result.gel.repository';

@Injectable()
export class PlanningExtractionResultSaver {
  constructor(private readonly repo: PnpExtractionResultRepository) {}

  async save(file: ID<'FileVersion'>, result: PnpExtractionResult) {
    await this.repo.save(file, result);
  }
}
