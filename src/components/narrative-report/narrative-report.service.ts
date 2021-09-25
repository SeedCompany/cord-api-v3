import { Injectable } from '@nestjs/common';
import {
  CalendarDate,
  DateInterval,
  ID,
  ServerException,
  Session,
} from '../../common';
import { FileService } from '../file';
import { PeriodicReportService, ReportType } from '../periodic-report';
import { NarrativeReportRepository } from './narrative-report.repository';

@Injectable()
export class NarrativeReportService {
  constructor(
    private readonly repo: NarrativeReportRepository,
    private readonly files: FileService,
    private readonly periodicReports: PeriodicReportService
  ) {}

  async create(engagementId: ID, interval: DateInterval, session: Session) {
    try {
      const { id, reportFileId } = await this.repo.create(
        engagementId,
        interval
      );

      await this.files.createDefinedFile(
        reportFileId,
        interval.end.toISODate(),
        session,
        id,
        'reportFile'
      );

      return await this.periodicReports.readOne(id, session);
    } catch (exception) {
      throw new ServerException('Could not create narrative report', exception);
    }
  }

  async delete(engagementId: ID, range: DateInterval[]) {
    await this.periodicReports.delete(
      engagementId,
      ReportType.Narrative,
      range
    );
  }

  async mergeFinalReport(id: ID, at: CalendarDate, session: Session) {
    await this.periodicReports.mergeFinalReport(
      id,
      ReportType.Narrative,
      at,
      session
    );
  }
}
