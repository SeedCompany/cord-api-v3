import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Interval } from 'luxon';
import {
  CalendarDate,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import {
  DatabaseService,
  HandleIdLookup,
  IEventBus,
  ILogger,
  Logger,
  OnIndex,
} from '../../core';
import { Variable } from '../../core/database/query';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { FileService } from '../file';
import {
  CreatePeriodicReport,
  FinancialReport,
  IPeriodicReport,
  NarrativeReport,
  PeriodicReport,
  PeriodicReportListInput,
  ProgressReport,
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
    private readonly db: DatabaseService,
    @Logger('periodic:report:service') private readonly logger: ILogger,
    private readonly eventBus: IEventBus,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: PeriodicReportRepository
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
    try {
      const { id, reportFileId } = await this.repo.create(input);

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

  async update(input: UpdatePeriodicReportInput, session: Session) {
    const current = await this.readOne(input.id, session);
    const changes = this.repo.getActualChanges(current, input);
    await this.authorizationService.verifyCanEditChanges(
      resolveReportType(current),
      current,
      changes
    );

    const { reportFile, ...simpleChanges } = changes;

    const updated = await this.repo.updateProperties(current, simpleChanges);

    if (reportFile) {
      await this.files.updateDefinedFile(
        current.reportFile,
        'file',
        input.reportFile,
        session
      );
      const newVersion = await this.files.getFileVersion(
        reportFile.uploadId,
        session
      );
      await this.eventBus.publish(
        new PeriodicReportUploadedEvent(updated, newVersion, session)
      );
    }

    return updated;
  }

  @HandleIdLookup([FinancialReport, NarrativeReport, ProgressReport])
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
    input: PeriodicReportListInput,
    session: Session
  ): Promise<SecuredPeriodicReportList> {
    const results = await this.repo.listProjectReports(projectId, reportType, {
      ...input,
    });

    return {
      ...(await mapListResults(results, (id) => this.readOne(id, session))),
      canRead: true,
      canCreate: true,
    };
  }

  async getCurrentReportDue(
    parentId: ID,
    reportType: ReportType,
    session: Session
  ): Promise<PeriodicReport | undefined> {
    const report = await this.repo.getCurrentDue(parentId, reportType);
    return report ? await this.secure(report, session) : undefined;
  }

  matchCurrentDue(parentId: ID | Variable, reportType: ReportType) {
    return this.repo.matchCurrentDue(parentId, reportType);
  }

  async getNextReportDue(
    parentId: ID,
    reportType: ReportType,
    session: Session
  ): Promise<PeriodicReport | undefined> {
    const report = await this.repo.getNextDue(parentId, reportType);
    return report ? await this.secure(report, session) : undefined;
  }

  async getLatestReportSubmitted(
    parentId: ID,
    type: ReportType,
    session: Session
  ): Promise<PeriodicReport | undefined> {
    const report = await this.repo.getFinalReport(parentId, type);
    return report ? await this.secure(report, session) : undefined;
  }

  async listEngagementReports(
    engagementId: string,
    input: PeriodicReportListInput,
    session: Session
  ): Promise<SecuredPeriodicReportList> {
    const results = await this.repo.listEngagementReports(engagementId, {
      ...input,
    });

    return {
      ...(await mapListResults(results, (id) => this.readOne(id, session))),
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

  async getFinalReport(
    parentId: ID,
    type: ReportType,
    session: Session
  ): Promise<PeriodicReport | undefined> {
    const report = await this.repo.getFinalReport(parentId, type);
    return report ? await this.secure(report, session) : undefined;
  }

  async createOrUpdateFinalReportWithDateRange(
    parentId: ID,
    type: ReportType,
    start: CalendarDate,
    end: CalendarDate,
    session: Session
  ): Promise<void> {
    const report = await this.repo.getFinalReport(parentId, type);

    if (report) {
      await this.db.updateProperties({
        type: IPeriodicReport,
        object: report,
        changes: {
          start,
          end,
        },
      });
    } else {
      await this.create(
        {
          start,
          end,
          type,
          projectOrEngagementId: parentId,
        },
        session
      );
    }
  }
}
