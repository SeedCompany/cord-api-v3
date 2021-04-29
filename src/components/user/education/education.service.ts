import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
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
} from '../../../core';
import {
  calculateTotalAndPaginateList,
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
  constructor(
    @Logger('education:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService
  ) {}

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
      .apply(matchRequestingUser(session))
      .match([
        node('user', 'User', {
          id: userId,
        }),
      ])
      .apply(createBaseNode(await generateId(), 'Education', secureProps))
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

  async readOne(id: ID, session: Session): Promise<Education> {
    this.logger.debug(`Read Education`, {
      id: id,
      userId: session.userId,
    });

    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Education', { id })])
      .apply(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Education>>>();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('Could not find education', 'education.id');
    }

    const secured = await this.authorizationService.secureProperties({
      resource: Education,
      props: result.propList,
      sessionOrUserId: session,
    });

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      canDelete: await this.db.checkDeletePermission(id, session), // TODO
    };
  }

  async update(input: UpdateEducation, session: Session): Promise<Education> {
    const ed = await this.readOne(input.id, session);
    const result = await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('user', 'User'),
        relation('out', '', 'education', { active: true }),
        node('education', 'Education', { id: input.id }),
      ])
      .return('user')
      .first();
    if (!result) {
      throw new NotFoundException(
        'Could not find user associated with education',
        'user.education'
      );
    }
    const changes = this.db.getActualChanges(Education, ed, input);
    if (result.user.properties.id !== session.userId) {
      await this.authorizationService.verifyCanEditChanges(
        Education,
        ed,
        changes
      );
    }

    await this.db.updateProperties({
      type: Education,
      object: ed,
      changes,
    });
    return await this.readOne(input.id, session);
  }

  async delete(_id: ID, _session: Session): Promise<void> {
    // Not Implemented
  }

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
      .apply(calculateTotalAndPaginateList(Education, input));

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
