import { Injectable } from '@nestjs/common';
import {
  type CalendarDate,
  type ID,
  type ObjectView,
  type Session,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup, IEventBus, ILogger, Logger } from '~/core';
import { type Variable } from '~/core/database/query';
import { Privileges } from '../authorization';
import { FileService } from '../file';
import { ProgressReport } from '../progress-report/dto';
import {
  FinancialReport,
  NarrativeReport,
  type PeriodicReport,
  type PeriodicReportListInput,
  type PeriodicReportTypeMap,
  type ReportType,
  resolveReportType,
  type SecuredPeriodicReportList,
  type UpdatePeriodicReportInput,
} from './dto';
import { PeriodicReportUploadedEvent } from './events';
import { PeriodicReportRepository } from './periodic-report.repository';

@Injectable()
export class PeriodicReportService {
  constructor(
    private readonly files: FileService,
    @Logger('periodic:report:service') private readonly logger: ILogger,
    private readonly eventBus: IEventBus,
    private readonly privileges: Privileges,
    private readonly repo: PeriodicReportRepository,
  ) {}

  async update(input: UpdatePeriodicReportInput, session: Session) {
    const current = await this.repo.readOne(input.id, session);
    const changes = this.repo.getActualChanges(current, input);
    this.privileges
      .for(session, resolveReportType(current), current)
      .verifyChanges(changes);

    const { reportFile, ...simpleChanges } = changes;

    const updated = this.secure(
      await this.repo.update(
        {
          id: current.id,
          start: current.start,
          end: current.end,
          ...simpleChanges,
        },
        session,
      ),
      session,
    );

    if (reportFile) {
      const file = await this.files.updateDefinedFile(
        this.secure(current, session).reportFile,
        'file',
        reportFile,
        session,
      );
      await this.eventBus.publish(
        new PeriodicReportUploadedEvent(
          updated,
          this.files.asDownloadable(file.newVersion),
          session,
        ),
      );
    }

    return updated;
  }

  @HandleIdLookup([FinancialReport, NarrativeReport, ProgressReport])
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<PeriodicReport> {
    const result = await this.repo.readOne(id, session);
    return this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const periodicReports = await this.repo.readMany(ids, session);
    return periodicReports.map((dto) => this.secure(dto, session));
  }

  private secure(
    dto: UnsecuredDto<PeriodicReport>,
    session: Session,
  ): PeriodicReport {
    return this.privileges.for(session, resolveReportType(dto)).secure(dto);
  }

  async list(
    session: Session,
    input: PeriodicReportListInput,
  ): Promise<SecuredPeriodicReportList> {
    const results = await this.repo.list(input, session);

    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
      canRead: true,
      canCreate: true,
    };
  }

  async getReportByDate<Type extends keyof PeriodicReportTypeMap>(
    parentId: ID,
    date: CalendarDate,
    reportType: Type & ReportType,
    session: Session,
  ): Promise<PeriodicReportTypeMap[Type] | undefined> {
    const report = await this.repo.getByDate(
      parentId,
      date,
      reportType,
      session,
    );
    return report
      ? (this.secure(report, session) as PeriodicReportTypeMap[Type])
      : undefined;
  }

  async getCurrentReportDue<Type extends keyof PeriodicReportTypeMap>(
    parentId: ID,
    reportType: Type & ReportType,
    session: Session,
  ): Promise<PeriodicReportTypeMap[Type] | undefined> {
    const report: UnsecuredDto<PeriodicReport> | undefined =
      await this.repo.getCurrentDue(parentId, reportType, session);
    return report
      ? (this.secure(report, session) as PeriodicReportTypeMap[Type])
      : undefined;
  }

  matchCurrentDue(parentId: ID | Variable, reportType: ReportType) {
    return this.repo.matchCurrentDue(parentId, reportType);
  }

  async getNextReportDue<Type extends keyof PeriodicReportTypeMap>(
    parentId: ID,
    reportType: Type & ReportType,
    session: Session,
  ): Promise<PeriodicReportTypeMap[Type] | undefined> {
    const report = await this.repo.getNextDue(parentId, reportType, session);
    return report
      ? (this.secure(report, session) as PeriodicReportTypeMap[Type])
      : undefined;
  }

  async getLatestReportSubmitted<Type extends keyof PeriodicReportTypeMap>(
    parentId: ID,
    type: Type & ReportType,
    session: Session,
  ): Promise<PeriodicReportTypeMap[Type] | undefined> {
    const report = await this.repo.getLatestReportSubmitted(
      parentId,
      type,
      session,
    );
    return report
      ? (this.secure(report, session) as PeriodicReportTypeMap[Type])
      : undefined;
  }

  async getFinalReport(
    parentId: ID,
    type: ReportType,
    session: Session,
  ): Promise<PeriodicReport | undefined> {
    const report = await this.repo.getFinalReport(parentId, type, session);
    return report ? this.secure(report, session) : undefined;
  }
}
