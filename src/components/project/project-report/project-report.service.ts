import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  NotFoundException,
  ServerException,
  Session,
} from '../../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  OnIndex,
  property,
} from '../../../core';
import {
  calculateTotalAndPaginateList,
  defaultSorter,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
  StandardReadResult,
} from '../../../core/database/results';
import { AuthorizationService } from '../../authorization/authorization.service';
import { FileService } from '../../file';
import { UserService } from '../../user';
import {
  CreateProjectReport,
  ProjectReport,
  ProjectReportListInput,
  ProjectReportListOutput,
  UpdateProjectReport,
} from './dto';
import { DbProjectReport } from './model';

@Injectable()
export class ProjectReportService {
  private readonly securedProperties = {
    reportType: true,
    periodType: true,
    period: true,
    reportFile: true,
  };

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly files: FileService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Logger('project:report:service') private readonly logger: ILogger,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:ProjectReport) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:ProjectReport) ASSERT n.id IS UNIQUE',
    ];
  }

  async create(
    { projectId, ...input }: CreateProjectReport,
    session: Session
  ): Promise<ProjectReport> {
    const id = await generateId();
    const createdAt = DateTime.local();
    const reportFileId = await generateId();

    try {
      const createProjectReport = this.db
        .query()
        .create([
          [
            node('newProjectReport', 'ProjectReport:BaseNode', {
              createdAt,
              id,
            }),
          ],
          ...property('reportType', input.reportType, 'newProjectReport'),
          ...property('periodType', input.periodType, 'newProjectReport'),
          ...property('period', input.periodType, 'newProjectReport'),
          ...property('reportFile', reportFileId, 'newProjectReport'),
        ])
        .return('newProjectReport.id as id');
      const result = await createProjectReport.first();

      if (!result) {
        throw new ServerException('Failed to create a project report');
      }

      // connect the Project to the ProjectReport
      const reportQuery = await this.db
        .query()
        .match([
          [node('user', 'User', { id: session.userId })],
          [node('project', 'Project', { id: projectId })],
          [node('projectReport', 'ProjectReport', { id: result.id })],
        ])
        .create([
          node('project'),
          relation('out', '', 'report', {
            active: true,
            createdAt: DateTime.local(),
          }),
          node('projectReport'),
          relation('out', '', 'user', {
            active: true,
            createdAt: DateTime.local(),
          }),
          node('user'),
        ])
        .return('projectReport.id as id')
        .first();

      await this.files.createDefinedFile(
        reportFileId,
        `Project Report File`,
        session,
        id,
        'reportFile',
        input.reportFile,
        'projectReport.reportFile'
      );

      const dbProjectReport = new DbProjectReport();
      await this.authorizationService.processNewBaseNode(
        dbProjectReport,
        reportQuery?.id,
        session.userId
      );

      return await this.readOne(id, session);
    } catch (exception) {
      throw new ServerException('Could not create project report', exception);
    }
  }

  async readOne(id: string, session: Session): Promise<ProjectReport> {
    this.logger.debug(`read one`, {
      id,
      userId: session.userId,
    });
    if (!id) {
      throw new NotFoundException(
        'No project report id to search for',
        'projectReport.id'
      );
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'ProjectReport', { id })])
      .call(matchPropList)
      .match([
        node('project', 'Project'),
        relation('out', '', 'report', { active: true }),
        node('', 'ProjectReport', { id }),
      ])
      .with(['project', 'node', 'propList'])
      .match([node('node'), relation('out', '', 'user'), node('user', 'User')])
      .return('node, propList, user.id as userId')
      .asResult<
        StandardReadResult<DbPropsOfDto<ProjectReport>> & {
          userId: string;
        }
      >();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find project report',
        'projectReport.id'
      );
    }

    const props = parsePropList(result.propList);
    const securedProps = await this.authorizationService.secureProperties(
      ProjectReport,
      props,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      user: {
        ...securedProps.user,
        value: await this.userService.readOne(result.userId, session),
      },
      reportType: props.reportType,
      periodType: props.periodType,
      period: props.period,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(
    { reportFile, ...input }: UpdateProjectReport,
    session: Session
  ): Promise<ProjectReport> {
    const object = await this.readOne(input.id, session);

    await this.files.updateDefinedFile(
      object.reportFile,
      'projectReport.reportFile',
      reportFile,
      session
    );

    return await this.db.sgUpdateProperties({
      session,
      object,
      props: ['reportType', 'periodType', 'period'],
      changes: input,
      nodevar: 'projectReport',
    });
  }

  async delete(id: string, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException(
        'Could not find project report',
        'projectReport.id'
      );
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (exception) {
      this.logger.warning('Failed to delete project report', {
        exception,
      });

      throw new ServerException('Failed to delete project report', exception);
    }
  }

  async list(
    { filter, ...input }: ProjectReportListInput,
    session: Session
  ): Promise<ProjectReportListOutput> {
    const label = 'ProjectReport';

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.projectId
          ? [
              relation('in', '', 'report'),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
