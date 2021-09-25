import { Injectable } from '@nestjs/common';
import { DateInterval, generateId, ID, ServerException } from '../../common';
import { DtoRepository } from '../../core';
import { createNode, createRelationships } from '../../core/database/query';
import { ReportType } from '../periodic-report';
import { NarrativeReport, NarrativeReportStatus } from './dto';

@Injectable()
export class NarrativeReportRepository extends DtoRepository(NarrativeReport) {
  async create(engagementId: ID, interval: DateInterval) {
    const reportFileId = await generateId();

    const initialProps = {
      type: ReportType.Narrative as const,
      start: interval.start,
      end: interval.end,
      receivedDate: null,
      reportFile: reportFileId,
      status: NarrativeReportStatus.Draft,
    };
    const query = this.db
      .query()
      .apply(await createNode(NarrativeReport, { initialProps }))
      .apply(
        createRelationships(NarrativeReport, 'in', {
          report: ['BaseNode', engagementId],
        })
      )
      .return<{ id: ID }>('node.id as id');
    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to create narrative report');
    }
    return { id: result.id, reportFileId };
  }
}
