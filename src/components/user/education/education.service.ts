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
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  Transactional,
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
  runListQuery,
  StandardReadResult,
} from '../../../core/database/results';
import { AuthorizationService } from '../../authorization/authorization.service';
import { DbEducation } from '../model';
import {
  CreateEducation,
  Education,
  EducationListInput,
  EducationListOutput,
  UpdateEducation,
} from './dto';

@Injectable()
export class EducationService {
  private readonly securedProperties = {
    degree: true,
    institution: true,
    major: true,
  };

  constructor(
    @Logger('education:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService
  ) {}

  @Transactional()
  async create(
    { userId, ...input }: CreateEducation,
    session: Session
  ): Promise<Education> {
    const createdAt = DateTime.local();

    const secureProps = [
      {
        key: 'degree',
        value: input.degree,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'institution',
        value: input.institution,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'major',
        value: input.major,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    // create education
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([
        node('user', 'User', {
          id: userId,
        }),
      ])
      .call(createBaseNode, await generateId(), 'Education', secureProps)
      .create([
        node('user'),
        relation('out', '', 'education', { active: true, createdAt }),
        node('node'),
      ])
      .return('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('failed to create education');
    }

    const dbEducation = new DbEducation();
    await this.authorizationService.processNewBaseNode(
      dbEducation,
      result.id,
      userId
    );

    this.logger.debug(`education created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  @Transactional()
  async readOne(id: string, session: Session): Promise<Education> {
    this.logger.debug(`Read Education`, {
      id: id,
      userId: session.userId,
    });

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Education', { id })])
      .call(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Education>>>();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find education', 'education.id');
    }

    const secured = await this.authorizationService.secureProperties(
      Education,
      result.propList,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      canDelete: await this.db.checkDeletePermission(id, session), // TODO
    };
  }

  @Transactional()
  async update(input: UpdateEducation, session: Session): Promise<Education> {
    const ed = await this.readOne(input.id, session);

    return await this.db.sgUpdateProperties({
      session,
      object: ed,
      props: ['degree', 'major', 'institution'],
      changes: input,
      nodevar: 'education',
    });
  }

  @Transactional()
  async delete(_id: string, _session: Session): Promise<void> {
    // Not Implemented
  }

  @Transactional()
  async list(
    { filter, ...input }: EducationListInput,
    session: Session
  ): Promise<EducationListOutput> {
    const label = 'Education';

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.userId
          ? [
              relation('in', '', 'education', { active: true }),
              node('user', 'User', {
                id: filter.userId,
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

  async checkEducationConsistency(session: Session): Promise<boolean> {
    const educations = await this.db
      .query()
      .match([matchSession(session), [node('education', 'Education')]])
      .return('education.id as id')
      .run();

    return (
      (
        await Promise.all(
          educations.map(async (education) => {
            return await this.db.hasProperties({
              session,
              id: education.id,
              props: ['degree', 'major', 'institution'],
              nodevar: 'education',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          educations.map(async (education) => {
            return await this.db.isUniqueProperties({
              session,
              id: education.id,
              props: ['degree', 'major', 'institution'],
              nodevar: 'education',
            });
          })
        )
      ).every((n) => n)
    );
  }
}
