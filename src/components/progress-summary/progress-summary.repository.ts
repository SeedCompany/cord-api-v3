import { Injectable } from '@nestjs/common';
import { ID, NotImplementedException, Session } from '../../common';
import { DtoRepository } from '../../core';
import { ProgressReport } from '../periodic-report/dto';
import { ProgressSummary } from './dto';

@Injectable()
export class ProgressSummaryRepository extends DtoRepository(ProgressSummary) {
  async readOne(
    reportId: ID,
    session: Session
  ): Promise<ProgressSummary | undefined> {
    throw new NotImplementedException().with(reportId, session);
  }

  async save(report: ProgressReport, data: ProgressSummary) {
    throw new NotImplementedException().with(report, data);
  }
}
