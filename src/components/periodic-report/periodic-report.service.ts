import { Injectable } from '@nestjs/common';
import {
  type CalendarDate,
  CreationFailed,
  DateInterval,
  type ID,
  NotFoundException,
  type ObjectView,
  type Range,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup, IEventBus, ILogger, Logger } from '~/core';
import { type Variable } from '~/core/database/query';
import { Privileges } from '../authorization';
import { FileService } from '../file';
import { ProgressReport } from '../progress-report/dto';
import {
  FinancialReport,
  type MergePeriodicReports,
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
      const Report = resolveReportType({ type: input.type });
      throw new CreationFailed(Report);
    }
  }

  async update(input: UpdatePeriodicReportInput) {
    const currentRaw = await this.repo.readOne(input.id);
    const current = this.secure(currentRaw);
    const changes = this.repo.getActualChanges(current, input);
    this.privileges
      .for(resolveReportType(current), currentRaw)
      .verifyChanges(changes);

    const { reportFile, ...simpleChanges } = changes;

    const updated = await this.repo.update(current, simpleChanges);

    if (reportFile) {
      const file = await this.files.updateDefinedFile(
        current.reportFile,
        'file',
        reportFile,
      );
      await this.eventBus.publish(
        new PeriodicReportUploadedEvent(
          updated,
          this.files.asDownloadable(file.newVersion),
        ),
      );
    }

    return updated;
  }

  @HandleIdLookup([FinancialReport, NarrativeReport, ProgressReport])
  async readOne(id: ID, _view?: ObjectView): Promise<PeriodicReport> {
    if (!id) {
      throw new NotFoundException(
        'No periodic report id to search for',
        'periodicReport.id',
      );
    }

    const result = await this.repo.readOne(id);
    return this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const periodicReports = await this.repo.readMany(ids);
    return periodicReports.map((dto) => this.secure(dto));
  }

  private secure(dto: UnsecuredDto<PeriodicReport>): PeriodicReport {
    return this.privileges.for(resolveReportType(dto)).secure(dto);
  }

  async list(
    input: PeriodicReportListInput,
  ): Promise<SecuredPeriodicReportList> {
    const results = await this.repo.list(input);

    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
      canRead: true,
      canCreate: true,
    };
  }

  async getReportByDate<Type extends keyof PeriodicReportTypeMap>(
    parentId: ID,
    date: CalendarDate,
    reportType: Type & ReportType,
  ): Promise<PeriodicReportTypeMap[Type] | undefined> {
    const report = await this.repo.getByDate(parentId, date, reportType);
    return report
      ? (this.secure(report) as PeriodicReportTypeMap[Type])
      : undefined;
  }

  async getCurrentReportDue<Type extends keyof PeriodicReportTypeMap>(
    parentId: ID,
    reportType: Type & ReportType,
  ): Promise<PeriodicReportTypeMap[Type] | undefined> {
    const report: UnsecuredDto<PeriodicReport> | undefined =
      await this.repo.getCurrentDue(parentId, reportType);
    return report
      ? (this.secure(report) as PeriodicReportTypeMap[Type])
      : undefined;
  }

  matchCurrentDue(parentId: ID | Variable, reportType: ReportType) {
    return this.repo.matchCurrentDue(parentId, reportType);
  }

  async getNextReportDue<Type extends keyof PeriodicReportTypeMap>(
    parentId: ID,
    reportType: Type & ReportType,
  ): Promise<PeriodicReportTypeMap[Type] | undefined> {
    const report = await this.repo.getNextDue(parentId, reportType);
    return report
      ? (this.secure(report) as PeriodicReportTypeMap[Type])
      : undefined;
  }

  async getLatestReportSubmitted<Type extends keyof PeriodicReportTypeMap>(
    parentId: ID,
    type: Type & ReportType,
  ): Promise<PeriodicReportTypeMap[Type] | undefined> {
    const report = await this.repo.getLatestReportSubmitted(parentId, type);
    return report
      ? (this.secure(report) as PeriodicReportTypeMap[Type])
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
  ): Promise<PeriodicReport | undefined> {
    const report = await this.repo.getFinalReport(parentId, type);
    return report ? this.secure(report) : undefined;
  }

  async mergeFinalReport(
    parentId: ID,
    type: ReportType,
    at: CalendarDate,
  ): Promise<void> {
    const report = await this.repo.getFinalReport(parentId, type);

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
      });
    }
  }
}
