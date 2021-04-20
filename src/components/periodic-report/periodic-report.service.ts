import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { inArray, isNull, node, relation } from 'cypher-query-builder';
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
import { CreateDefinedFileVersionInput, FileId, FileService } from '../file';
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

@Injectable()
export class PeriodicReportService {
  constructor(
    private readonly db: DatabaseService,
    private readonly files: FileService,
    @Logger('periodic:report:service') private readonly logger: ILogger,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService
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
      const createPeriodicReport = this.db
        .query()
        .create([
          [
            node(
              'newPeriodicReport',
              ['PeriodicReport', 'BaseNode', `${input.type}Report`],
              {
                createdAt,
                id,
              }
            ),
          ],
          ...property('type', input.type, 'newPeriodicReport'),
          ...property('start', input.start, 'newPeriodicReport'),
          ...property('end', input.end, 'newPeriodicReport'),
          ...property('reportFile', reportFileId, 'newPeriodicReport'),
        ])
        .return('newPeriodicReport.id as id');
      const result = await createPeriodicReport.first();

      if (!result) {
        throw new ServerException('Failed to create a periodic report');
      }

      await this.db
        .query()
        .match(
          node(
            'node',
            input.type === ReportType.Progress ? 'Engagement' : 'Project',
            { id: input.projectOrEngagementId }
          )
        )
        .match(node('periodicReport', 'PeriodicReport', { id: result.id }))
        .create([
          node('node'),
          relation('out', '', 'report', {
            active: true,
            createdAt: DateTime.local(),
          }),
          node('periodicReport'),
        ])
        .run();

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

    return await this.files.resolveDefinedFile(report.reportFile, session);
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

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'PeriodicReport', { id })])
      .call(matchPropList)
      .optionalMatch([
        node('node'),
        relation('out', '', 'reportFile', { active: true }),
        node('reportFile', 'File'),
      ])
      .return('node, propList, reportFile.id as reportFileId')
      .asResult<
        StandardReadResult<DbPropsOfDto<PeriodicReport>> & {
          reportFileId: FileId;
        }
      >();

    const result = await query.first();
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
      ...securedProps,
      type: props.type,
      start: props.start,
      end: props.end,
      reportFile: {
        ...securedProps.reportFile,
        value: result.reportFileId,
      },
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException(
        'Could not find periodic report',
        'periodicReport.id'
      );
    }

    try {
      await this.db.deleteNode(object);
    } catch (exception) {
      this.logger.warning('Failed to delete periodic report', {
        exception,
      });

      throw new ServerException('Failed to delete periodic report', exception);
    }
  }

  async listProjectReports(
    projectId: string,
    reportType: ReportType,
    { filter, ...input }: PeriodicReportListInput,
    session: Session
  ): Promise<SecuredPeriodicReportList> {
    const query = this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'report', { active: true }),
        node('node', ['PeriodicReport', `${reportType}Report`]),
      ])
      .call(
        calculateTotalAndPaginateList(
          reportType === 'Financial' ? FinancialReport : NarrativeReport,
          input
        )
      );

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
    const query = this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: engagementId }),
        relation('out', '', 'report', { active: true }),
        node('node', `PeriodicReport:${reportType}Report`),
      ])
      .call(calculateTotalAndPaginateList(ProgressReport, input));

    return {
      ...(await runListQuery(query, input, (id) => this.readOne(id, session))),
      canRead: true,
      canCreate: true,
    };
  }

  getProjectReportsQuery(projectId: ID) {
    return this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'report', { active: true }),
        node('report', 'PeriodicReport'),
      ])
      .optionalMatch([
        node('report'),
        relation('out', 'rel', 'reportFile', { active: true }),
        node('file', 'File'),
      ])
      .optionalMatch([
        node('report'),
        relation('out', '', 'start', { active: true }),
        node('start', 'Property'),
      ])
      .optionalMatch([
        node('report'),
        relation('out', '', 'end', { active: true }),
        node('end', 'Property'),
      ])
      .optionalMatch([
        node('report'),
        relation('out', '', 'type', { active: true }),
        node('type', 'Property'),
      ])
      .with('report, rel, start, end, type');
  }

  async removeFinancialReports(
    projectId: ID,
    intervals: Interval[],
    session: Session
  ) {
    const reports = await this.getProjectReportsQuery(projectId)
      .where({
        rel: isNull(),
        'start.value': inArray(intervals.map((interval) => interval.start)),
        type: {
          value: ReportType.Financial,
        },
      })
      .return('report.id as reportId')
      .asResult<{ reportId: ID }>()
      .run();

    await Promise.all(
      reports.map((report) => this.delete(report.reportId, session))
    );
  }

  async removeNarrativeReports(
    projectId: ID,
    intervals: Interval[],
    session: Session
  ) {
    const reports = await this.getProjectReportsQuery(projectId)
      .where({
        rel: isNull(),
        'start.value': inArray(intervals.map((interval) => interval.start)),
        type: {
          value: ReportType.Narrative,
        },
      })
      .return('report.id as reportId')
      .asResult<{ reportId: ID }>()
      .run();

    await Promise.all(
      reports.map((report) => this.delete(report.reportId, session))
    );
  }

  async removeProgressReports(
    engagementId: ID,
    intervals: Interval[],
    session: Session
  ) {
    if (intervals.length === 0) {
      return;
    }

    const reports = await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: engagementId }),
        relation('out', '', 'report', { active: true }),
        node('report', 'PeriodicReport'),
      ])
      .optionalMatch([
        node('report'),
        relation('out', 'rel', 'reportFile', { active: true }),
        node('file', 'File'),
      ])
      .optionalMatch([
        node('report'),
        relation('out', '', 'start', { active: true }),
        node('start', 'Property'),
      ])
      .optionalMatch([
        node('report'),
        relation('out', '', 'end', { active: true }),
        node('end', 'Property'),
      ])
      .with('report, rel, start, end')
      .where({
        rel: isNull(),
        'start.value': inArray(intervals.map((interval) => interval.start)),
      })
      .return('report.id as reportId')
      .asResult<{ reportId: ID }>()
      .run();

    await Promise.all(
      reports.map((report) => this.delete(report.reportId, session))
    );
  }
}
