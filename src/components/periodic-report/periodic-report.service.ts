import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  asyncPool,
  CalendarDate,
  DateInterval,
  ID,
  NotFoundException,
  ObjectView,
  Range,
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
  FinancialReport,
  MergePeriodicReports,
  NarrativeReport,
  PeriodicReport,
  PeriodicReportListInput,
  ProgressReport,
  ReportType,
  resolveReportType,
  SecuredPeriodicReportList,
  UpdatePeriodicReportInput,
} from './dto';
import { PnpProgressUploadedEvent } from './events';
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

  async merge(input: MergePeriodicReports, session: Session) {
    if (input.intervals.length === 0) {
      return;
    }
    try {
      const result = await this.repo.merge(input, session);

      this.logger.info(`Merged ${input.type.toLowerCase()} reports`, {
        existing: input.intervals.length - result.length,
        new: result.length,
        parent: input.parent,
        newIntervals: result.map(({ interval }) =>
          DateInterval.fromObject(interval).toISO()
        ),
      });
    } catch (exception) {
      throw new ServerException('Could not create periodic reports', exception);
    }
  }

  async update(input: UpdatePeriodicReportInput, session: Session) {
    const current = await this.readOne(input.id, session);

    if (current.type === ReportType.Progress) {
      return await this.updateProgressReport(current, input, session);
    } else {
      const { pnp, ...rest } = input;
      const changes = this.repo.getActualChanges(current, rest);
      await this.authorizationService.verifyCanEditChanges(
        resolveReportType(current),
        current,
        changes
      );

      const updated = await this.repo.updateProperties(current, changes);
      return updated;
    }
  }

  async updateProgressReport(
    report: ProgressReport,
    input: UpdatePeriodicReportInput,
    session: Session
  ) {
    const changes = this.repo.getActualChanges(report, input);
    await this.authorizationService.verifyCanEditChanges(
      resolveReportType(report),
      report,
      changes
    );
    const { pnp, ...simpleChanges } = changes;
    const updated = await this.repo.updateProperties(report, simpleChanges);
    if (pnp) {
      await this.files.updateDefinedFile(
        report.pnp,
        'file',
        input.pnp,
        session
      );
      const newVersion = await this.files.getFileVersion(pnp.uploadId, session);

      await this.eventBus.publish(
        new PnpProgressUploadedEvent(updated, newVersion, session)
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

  async readMany(ids: readonly ID[], session: Session) {
    const periodicReports = await this.repo.readMany(ids, session);
    return await asyncPool(25, periodicReports, (dto) =>
      this.secure(dto, session)
    );
  }

  private async secure(
    dto: UnsecuredDto<PeriodicReport>,
    session: Session
  ): Promise<PeriodicReport> {
    const securedProps = await this.authorizationService.secureProperties(
      resolveReportType(dto),
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
    session: Session,
    input: PeriodicReportListInput
  ): Promise<SecuredPeriodicReportList> {
    const results = await this.repo.list(input, session);

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

  async delete(
    parent: ID,
    type: ReportType,
    intervals: ReadonlyArray<Range<CalendarDate | null>>
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
      if (+report.start === +at) {
        // no change
        return;
      }
      await this.repo.updateProperties(report, {
        start: at,
        end: at,
      });
    } else {
      await this.merge(
        {
          intervals: [{ start: at, end: at }],
          type,
          parent: parentId,
          session,
        },
        session
      );
    }
  }
}
