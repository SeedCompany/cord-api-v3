import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Interval } from 'luxon';
import {
  CalendarDate,
  ID,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, IEventBus, ILogger, Logger } from '../../core';
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
    @Logger('periodic:report:service') private readonly logger: ILogger,
    private readonly eventBus: IEventBus,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: PeriodicReportRepository
  ) {}

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
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView
  ): Promise<PeriodicReport> {
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

    const result = await this.repo.readOne(id, session);
    return await this.secure(result, session);
  }

  private async secure(
    dto: UnsecuredDto<PeriodicReport>,
    session: Session
  ): Promise<PeriodicReport> {
    const securedProps = await this.authorizationService.secureProperties(
      IPeriodicReport,
      dto,
      session,
      dto.scope
    );

    return {
      ...dto,
      ...securedProps,
      canDelete: false, // Auto generated, no user deleting.
    };
  }

  async list(
    projectId: ID,
    reportType: ReportType,
    input: PeriodicReportListInput,
    session: Session
  ): Promise<SecuredPeriodicReportList> {
    const results = await this.repo.listReports(
      projectId,
      reportType,
      input,
      session
    );

    return {
      ...(await mapListResults(results, (dto) => this.secure(dto, session))),
      canRead: true,
      canCreate: true,
    };
  }

  async getCurrentReportDue(
    parentId: ID,
    reportType: ReportType,
    session: Session
  ): Promise<PeriodicReport | undefined> {
    const report = await this.repo.getCurrentDue(parentId, reportType, session);
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
    const report = await this.repo.getNextDue(parentId, reportType, session);
    return report ? await this.secure(report, session) : undefined;
  }

  async getLatestReportSubmitted(
    parentId: ID,
    type: ReportType,
    session: Session
  ): Promise<PeriodicReport | undefined> {
    const report = await this.repo.getLatestReportSubmitted(
      parentId,
      type,
      session
    );
    return report ? await this.secure(report, session) : undefined;
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
    const report = await this.repo.getFinalReport(parentId, type, session);
    return report ? await this.secure(report, session) : undefined;
  }

  async mergeFinalReport(
    parentId: ID,
    type: ReportType,
    at: CalendarDate,
    session: Session
  ): Promise<void> {
    const report = await this.repo.getFinalReport(parentId, type, session);

    if (report) {
      await this.repo.updateProperties(report, {
        start: at,
        end: at,
      });
    } else {
      await this.create(
        {
          start: at,
          end: at,
          type,
          projectOrEngagementId: parentId,
        },
        session
      );
    }
  }
}
