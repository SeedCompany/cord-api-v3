import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  NotFoundException,
  ServerException,
  Session,
} from '../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  OnIndex,
  property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  defaultSorter,
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
import { UserService } from '../user';
import {
  CreatePeriodicReport,
  IPeriodicReport,
  PeriodicReport,
  PeriodicReportListInput,
  ReportType,
  SecuredPeriodicReportList,
  UpdatePeriodicReport,
} from './dto';

@Injectable()
export class PeriodicReportService {
  private readonly securedProperties = {
    type: true,
    start: true,
    end: true,
    reportFile: true,
  };

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly files: FileService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
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
        ])
        .return('newPeriodicReport.id as id');
      const result = await createPeriodicReport.first();

      if (!result) {
        throw new ServerException('Failed to create a periodic report');
      }

      return await this.readOne(id, session);
    } catch (exception) {
      throw new ServerException('Could not create periodic report', exception);
    }
  }

  async uploadFile(
    reportId: string,
    file: CreateDefinedFileVersionInput,
    session: Session
  ) {
    const reportFileId = await generateId();

    await this.files.createDefinedFile(
      reportFileId,
      file.name ?? 'Report File',
      session,
      reportId,
      'reportFile',
      file,
      'periodicReport.reportFile'
    );

    await this.db
      .query()
      .match(node('periodicReport', 'PeriodicReport', { id: reportId }))
      .match(node('file', 'File', { id: reportFileId }))
      .create([
        node('periodicReport'),
        relation('out', '', 'reportFile', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('file'),
      ])
      .run();

    return await this.files.resolveDefinedFile(
      {
        value: reportFileId,
        canRead: true,
        canEdit: true,
      },
      session
    );
  }

  async readOne(id: string, session: Session): Promise<PeriodicReport> {
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
          reportFileId: string;
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
      reportFile: await this.files.resolveDefinedFile(
        {
          value: result.reportFileId,
          canEdit: true,
          canRead: true,
        },
        session
      ),
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(
    { reportFile, ...input }: UpdatePeriodicReport,
    session: Session
  ): Promise<PeriodicReport> {
    const object = await this.readOne(input.id, session);

    return await this.db.sgUpdateProperties({
      session,
      object,
      props: ['start', 'end'],
      changes: input,
      nodevar: 'periodicReport',
    });
  }

  async delete(id: string, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException(
        'Could not find periodic report',
        'periodicReport.id'
      );
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
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
        node('node', `PeriodicReport:${reportType}Report`),
      ])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
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
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return {
      ...(await runListQuery(query, input, (id) => this.readOne(id, session))),
      canRead: true,
      canCreate: true,
    };
  }
}
