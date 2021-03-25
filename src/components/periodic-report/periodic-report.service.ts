import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
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
import { matchPropList } from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { FileService } from '../file';
import { UserService } from '../user';
import {
  CreatePeriodicReport,
  IPeriodicReport,
  PeriodicReport,
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
    const reportFileId = await generateId();

    try {
      const createPeriodicReport = this.db
        .query()
        .create([
          [
            node('newPeriodicReport', 'PeriodicReport:BaseNode', {
              createdAt,
              id,
            }),
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

      // connect the Periodic to the PeriodicReport

      await this.files.createDefinedFile(
        reportFileId,
        `Periodic Report File`,
        session,
        id,
        'reportFile',
        input.reportFile,
        'periodicReport.reportFile'
      );

      return await this.readOne(id, session);
    } catch (exception) {
      throw new ServerException('Could not create periodic report', exception);
    }
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
      .match([node('', 'PeriodicReport', { id })])
      .with(['node', 'propList'])
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
      ...securedProps,
      type: props.type,
      start: props.start,
      end: props.end,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(
    { reportFile, ...input }: UpdatePeriodicReport,
    session: Session
  ): Promise<PeriodicReport> {
    const object = await this.readOne(input.id, session);

    await this.files.updateDefinedFile(
      object.reportFile,
      'periodicReport.reportFile',
      reportFile,
      session
    );

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

  // async list(
  //   { filter, ...input }: PeriodicReportListInput,
  //   session: Session
  // ): Promise<PeriodicReportListOutput> {
  //   const query = this.db
  //     .query()
  //     .match([
  //       node('node', 'PeriodicReport'),
  //       ...(filter.periodicId
  //         ? [
  //             relation('in', '', 'report'),
  //             node('periodic', 'Periodic', {
  //               id: filter.periodicId,
  //             }),
  //           ]
  //         : []),
  //     ])
  //     .call(
  //       calculateTotalAndPaginateList,
  //       input,
  //       this.securedProperties,
  //       defaultSorter
  //     );

  //   return await runListQuery(query, input, (id) => this.readOne(id, session));
  // }
}
