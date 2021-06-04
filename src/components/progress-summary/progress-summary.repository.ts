import { Injectable } from '@nestjs/common';
import { NotImplementedException } from '../../common';
import { DtoRepository } from '../../core';
import { ProgressReport } from '../periodic-report/dto';
import { ProgressSummary } from './dto';

@Injectable()
export class ProgressSummaryRepository extends DtoRepository(ProgressSummary) {
  async save(report: ProgressReport, data: ProgressSummary) {
    throw new NotImplementedException().with(report, data);
  }
}
