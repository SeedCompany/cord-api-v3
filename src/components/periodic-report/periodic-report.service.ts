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
      .return('node, propList')
      .asResult<StandardReadResult<DbPropsOfDto<PeriodicReport>>>();

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
      ...props,
      ...securedProps,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
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

  async delete(baseNodeId: ID, type: ReportType, intervals: Interval[]) {
    if (intervals.length === 0) {
      return;
    }

    const result = await this.db
      .query()
      .match([
        node('node', 'BaseNode', { id: baseNodeId }),
        relation('out', '', 'report', { active: true }),
        node('report', `${type}Report`),
      ])
      .optionalMatch([
        node('report'),
        relation('out', '', 'start', { active: true }),
        node('start', 'Property'),
      ])
      .with('report, start')
      .raw(
        stripIndent`
          WHERE NOT (report)-[:reportFileNode]->(:File)<-[:parent { active: true }]-(:FileVersion)
            AND start.value IN $startDates
      `,
        {
          startDates: intervals.map((interval) => interval.start),
        }
      )
      .with('report as baseNode')
      .call(deleteBaseNode)
      .return('count(node) as count')
      .asResult<{ count: number }>()
      .first();
    this.logger.debug('Deleted reports', { baseNodeId, type, ...result });
  }
}
