import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DateTime, DurationUnit, Interval } from 'luxon';
import {
  CalendarDate,
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { IEventBus, ILogger, Logger, OnIndex } from '../../core';
import { runListQuery } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { CreateDefinedFileVersionInput, FileService } from '../file';
import { ProjectService } from '../project';
import {
  CreatePeriodicReport,
  IPeriodicReport,
  PeriodicReport,
  PeriodicReportListInput,
  ReportPeriod,
  ReportType,
  SecuredPeriodicReportList,
} from './dto';
import { PeriodicReportUploadedEvent } from './events';
import { PeriodicReportRepository } from './periodic-report.repository';

@Injectable()
export class PeriodicReportService {
  constructor(
    private readonly files: FileService,
    @Logger('periodic:report:service') private readonly logger: ILogger,
    private readonly eventBus: IEventBus,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: PeriodicReportRepository,
    @Inject(forwardRef(() => ProjectService))
    private readonly project: ProjectService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:PeriodicReport) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:PeriodicReport) ASSERT n.id IS UNIQUE',
    ];
  }

  async create(
    input: CreatePeriodicReport,
    session: Session
  ): Promise<PeriodicReport> {
    const id = await generateId();
    const createdAt = DateTime.local();

    const reportFileId = await generateId();

    try {
      const result = await this.repo.create(
        input,

        createdAt,
        id,
        reportFileId
      );

      if (!result) {
        throw new ServerException('Failed to create a periodic report');
      }

      await this.repo.createProperties(input, result);

      await this.files.createDefinedFile(
        reportFileId,
        input.end.toISODate(),
        session,
        id,
        'reportFile'
      );

      return await this.readOne(id, session);
    } catch (exception) {
      throw new ServerException('Could not create periodic report', exception);
    }
  }

  async uploadFile(
    reportId: ID,
    file: CreateDefinedFileVersionInput,
    session: Session
  ) {
    const report = await this.readOne(reportId, session);

    await this.files.updateDefinedFile(
      report.reportFile,
      'file',
      file,
      session
    );
    const newVersion = await this.files.getFileVersion(file.uploadId, session);
    await this.eventBus.publish(
      new PeriodicReportUploadedEvent(report, newVersion, session)
    );

    return report;
  }

  async readOne(id: ID, session: Session): Promise<PeriodicReport> {
    this.logger.debug(`read one`, {
      id,
      userId: session.userId,
    });
    if (!id) {
      throw new NotFoundException(
        'No periodic report id to search for',
        'periodicReport.id'
      );
    }

    const result = await this.repo.readOne(id);
    return await this.secure(result, session);
  }

  private async secure(
    dto: UnsecuredDto<PeriodicReport>,
    session: Session
  ): Promise<PeriodicReport> {
    const securedProps = await this.authorizationService.secureProperties(
      IPeriodicReport,
      dto,
      session
    );

    return {
      ...dto,
      ...securedProps,
      canDelete: false, // Auto generated, no user deleting.
    };
  }

  async listProjectReports(
    projectId: string,
    reportType: ReportType,
    { filter, ...input }: PeriodicReportListInput,
    session: Session
  ): Promise<SecuredPeriodicReportList> {
    const query = this.repo.listProjectReports(projectId, reportType, {
      filter,
      ...input,
    });

    return {
      ...(await runListQuery(query, input, (id) => this.readOne(id, session))),
      canRead: true,
      canCreate: true,
    };
  }

  async getReportForDate(
    parentId: ID,
    reportType: ReportType,
    date: CalendarDate,
    session: Session
  ): Promise<PeriodicReport | undefined> {
    const report = await this.repo.reportForDate(parentId, reportType, date);
    return report ? await this.secure(report, session) : undefined;
  }

  async getCurrentReportDue(
    parentId: ID,
    reportType: ReportType,
    session: Session
  ): Promise<PeriodicReport | undefined> {
    let interval: DurationUnit = 'quarter';
    if (reportType === ReportType.Financial) {
      const project = await this.project.readOne(parentId, session);
      if (project.financialReportPeriod.value === ReportPeriod.Monthly) {
        interval = 'month';
      }
    }

    return await this.getReportForDate(
      parentId,
      reportType,
      CalendarDate.local().minus({ [interval]: 1 }),
      session
    );
  }

  async getNextReportDue(
    parentId: ID,
    reportType: ReportType,
    session: Session
  ): Promise<PeriodicReport | undefined> {
    return await this.getReportForDate(
      parentId,
      reportType,
      CalendarDate.local(),
      session
    );
  }

  async getLatestReportSubmitted(
    parentId: ID,
    type: ReportType,
    session: Session
  ): Promise<PeriodicReport | undefined> {
    const report = await this.repo.getLatestReportSubmitted(parentId, type);
    return report ? await this.secure(report, session) : undefined;
  }

  async listEngagementReports(
    engagementId: string,
    { filter, ...input }: PeriodicReportListInput,
    session: Session
  ): Promise<SecuredPeriodicReportList> {
    const query = this.repo.listEngagementReports(engagementId, {
      filter,
      ...input,
    });

    return {
      ...(await runListQuery(query, input, (id) => this.readOne(id, session))),
      canRead: true,
      canCreate: true,
    };
  }

  async delete(baseNodeId: ID, type: ReportType, intervals: Interval[]) {
    if (intervals.length === 0) {
      return;
    }
    const result = await this.repo.delete(baseNodeId, type, intervals);

    this.logger.debug('Deleted reports', { baseNodeId, type, ...result });
  }
}
