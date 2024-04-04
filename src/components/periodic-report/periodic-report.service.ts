import { Injectable } from '@nestjs/common';
import {
  CalendarDate,
  DateInterval,
  ID,
  NotFoundException,
  ObjectView,
  Range,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { HandleIdLookup, IEventBus, ILogger, Logger } from '~/core';
import { Variable } from '~/core/database/query';
import { Privileges } from '../authorization';
import { FileService } from '../file';
import { ProgressReport } from '../progress-report/dto';
import {
  FinancialReport,
  MergePeriodicReports,
  NarrativeReport,
  PeriodicReport,
  PeriodicReportListInput,
  PeriodicReportTypeMap,
  ReportType,
  resolveReportType,
  SecuredPeriodicReportList,
  UpdatePeriodicReportInput,
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

  async merge(input: MergePeriodicReports) {
    if (input.intervals.length === 0) {
      return;
    }
    try {
      const result = await this.repo.merge(input);
      this.logger.info(`Merged ${input.type.toLowerCase()} reports`, {
        existing: input.intervals.length - result.length,
        new: result.length,
        parent: input.parent,
        newIntervals: result.map(({ interval }) =>
          DateInterval.fromObject(interval).toISO(),
        ),
      });
    } catch (exception) {
      throw new ServerException('Could not create periodic reports', exception);
    }
  }

  async update(input: UpdatePeriodicReportInput, session: Session) {
    const currentRaw = await this.repo.readOne(input.id, session);
    const current = this.secure(currentRaw, session);
    const changes = this.repo.getActualChanges(current, input);
    this.privileges
      .for(session, resolveReportType(current), currentRaw)
      .verifyChanges(changes);

    const { reportFile, ...simpleChanges } = changes;

    const updated = await this.repo.update(current, simpleChanges);

    if (reportFile) {
      const file = await this.files.updateDefinedFile(
        current.reportFile,
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
    this.logger.debug(`read one`, {
      id,
      userId: session.userId,
    });
    if (!id) {
      throw new NotFoundException(
        'No periodic report id to search for',
        'periodicReport.id',
      );
    }

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

  async delete(
    parent: ID,
    type: ReportType,
    intervals: ReadonlyArray<Range<CalendarDate | null>>,
  ) {
    intervals = intervals.filter((i) => i.start || i.end);
    if (intervals.length === 0) {
      return;
    }
    const result = await this.repo.delete(parent, type, intervals);

    this.logger.info('Deleted reports', { parent, type, ...result });
  }

  async getFinalReport(
    parentId: ID,
    type: ReportType,
    session: Session,
  ): Promise<PeriodicReport | undefined> {
    const report = await this.repo.getFinalReport(parentId, type, session);
    return report ? this.secure(report, session) : undefined;
  }

  async mergeFinalReport(
    parentId: ID,
    type: ReportType,
    at: CalendarDate,
    session: Session,
  ): Promise<void> {
    const report = await this.repo.getFinalReport(parentId, type, session);

    if (report) {
      if (+report.start === +at) {
        // no change
        return;
      }
      await this.repo.update(report, {
        start: at,
        end: at,
      });
    } else {
      await this.merge({
        intervals: [{ start: at, end: at }],
        type,
        parent: parentId,
        session,
      });
    }
  }
}
