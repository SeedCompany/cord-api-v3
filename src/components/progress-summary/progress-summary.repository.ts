import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID } from '../../common';
import { DtoRepository } from '../../core';
import { ProgressReport } from '../periodic-report/dto';
import { ProgressSummary } from './dto';

@Injectable()
export class ProgressSummaryRepository extends DtoRepository(ProgressSummary) {
  async readOne(reportId: ID): Promise<ProgressSummary | undefined> {
    const result = await this.db
      .query()
      .match([
        node('', 'ProgressReport', { id: reportId }),
        relation('out', '', 'summary', { active: true }),
        node('ps', 'ProgressSummary'),
      ])
      .return('ps as summary')
      .asResult<{ summary: ProgressSummary }>()
      .first();
    return result?.summary;
  }

  async save(report: ProgressReport, data: ProgressSummary) {
    await this.db
      .query()
      .merge([
        node('', 'ProgressReport', { id: report.id }),
        relation('out', '', 'summary', { active: true }),
        node('summary', 'ProgressSummary'),
      ])
      .setValues({ summary: data })
      .run();
  }
}
