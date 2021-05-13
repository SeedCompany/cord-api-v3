import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { stripIndent } from 'common-tags';
import { node, relation } from 'cypher-query-builder';
import { DateTime, Interval } from 'luxon';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
} from '../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  OnIndex,
  property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  deleteBaseNode,
  matchPropList,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { CreateDefinedFileVersionInput, FileService } from '../file';
import {
  CreatePeriodicReport,
  FinancialReport,
  IPeriodicReport,
  NarrativeReport,
  PeriodicReport,
  PeriodicReportListInput,
  ProgressReport,
  ReportType,
  SecuredPeriodicReportList,
} from './dto';
import { PeriodicReportRepository } from './periodic-report.repository';

@Injectable()
export class PeriodicReportService {
  constructor(
    private readonly files: FileService,
    @Logger('periodic:report:service') private readonly logger: ILogger,
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

    const result = await this.repo.readOne(id, session);

    if (!result) {
      throw new NotFoundException(
        'Could not find periodic report',
        'periodicReport.id'
      );
    }

    const props = parsePropList(result.propList);
    const securedProps = await this.authorizationService.secureProperties(
      IPeriodicReport,
      props,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...props,
      ...securedProps,
      canDelete: await this.repo.checkDeletePermission(id, session),
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

  async listEngagementReports(
    engagementId: string,
    reportType: ReportType,
    { filter, ...input }: PeriodicReportListInput,
    session: Session
  ): Promise<SecuredPeriodicReportList> {
    const query = this.repo.listEngagementReports(engagementId, reportType, {
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
