import { Injectable } from '@nestjs/common';
import {
  type CalendarDate,
  type ID,
  type ObjectView,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup, IEventBus, ILogger, Logger } from '~/core';
import { Identity } from '~/core/authentication';
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
    private readonly identity: Identity,
    private readonly privileges: Privileges,
    private readonly repo: PeriodicReportRepository,
  ) {}

  async update(input: UpdatePeriodicReportInput) {
    const current = await this.repo.readOne(input.id);
    const changes = this.repo.getActualChanges(
      current,
      //TODO - elimate this type assertion below somehow
      input as UpdatePeriodicReportInput & Record<any, never>,
    );
    this.privileges
      .for(resolveReportType(current), current)
      .verifyChanges(changes);

    const { reportFile, ...simpleChanges } = changes;

    const updated = this.secure(
      await this.repo.update({
        id: current.id,
        start: current.start,
        end: current.end,
        ...simpleChanges,
      }),
    );

    if (reportFile) {
      const file = await this.files.updateDefinedFile(
        this.secure(current).reportFile,
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

  async getFinalReport(
    parentId: ID,
    type: ReportType,
  ): Promise<PeriodicReport | undefined> {
    const report = await this.repo.getFinalReport(parentId, type);
    return report ? this.secure(report) : undefined;
  }
}
