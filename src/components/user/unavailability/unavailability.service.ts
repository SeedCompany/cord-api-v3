import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
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
} from '../../../core';
import { matchPropList } from '../../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  StandardReadResult,
} from '../../../core/database/results';
import { AuthorizationService } from '../../authorization/authorization.service';
import { DbUnavailability } from '../model';
import {
  CreateUnavailability,
  Unavailability,
  UnavailabilityListInput,
  UnavailabilityListOutput,
  UpdateUnavailability,
} from './dto';

@Injectable()
export class UnavailabilityService {
  constructor(
    @Logger('unavailability:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService
  ) {}

  async create(
    { userId, ...input }: CreateUnavailability,
    session: Session
  ): Promise<Unavailability> {
    const secureProps = [
      {
        key: 'description',
        value: input.description,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'start',
        value: input.start,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'end',
        value: input.end,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    try {
      const createUnavailability = this.db
        .query()
        .call(matchRequestingUser, session)
        .call(
          createBaseNode,
          await generateId(),
          'Unavailability',
          secureProps,
          {}
        )
        .return('node.id as id')
        .asResult<{ id: string }>();

      const createUnavailabilityResult = await createUnavailability.first();

      if (!createUnavailabilityResult) {
        this.logger.error(`Could not create unavailability`, {
          userId,
        });
        throw new ServerException('Could not create unavailability');
      }

      this.logger.debug(`Created user unavailability`, {
        id: createUnavailabilityResult.id,
        userId,
      });

      // connect the Unavailability to the User.

      const query = `
        MATCH (user: User {id: $userId}),
        (unavailability:Unavailability {id: $id})
        CREATE (user)-[:unavailability {active: true, createdAt: datetime()}]->(unavailability)
        RETURN  unavailability.id as id
        `;
      await this.db
        .query()
        .raw(query, {
          userId,
          id: createUnavailabilityResult.id,
        })
        .run();

      const dbUnavailability = new DbUnavailability();
      await this.authorizationService.processNewBaseNode(
        dbUnavailability,
        createUnavailabilityResult.id,
        userId
      );

      return await this.readOne(createUnavailabilityResult.id, session);
    } catch {
      this.logger.error(`Could not create unavailability`, {
        userId,
      });
      throw new ServerException('Could not create unavailability');
    }
  }

  async readOne(id: string, session: Session): Promise<Unavailability> {
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Unavailability', { id })])
      .call(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Unavailability>>>();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find user', 'user.id');
    }

    const securedProps = await this.authorizationService.secureProperties(
      Unavailability,
      result.propList,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      canDelete: await this.db.checkDeletePermission(id, session), // TODO
    };
  }

  async update(
    input: UpdateUnavailability,
    session: Session
  ): Promise<Unavailability> {
    const unavailability = await this.readOne(input.id, session);

    return await this.db.sgUpdateProperties({
      session,
      object: unavailability,
      props: ['description', 'start', 'end'],
      changes: input,
      nodevar: 'unavailability',
    });
  }

  async delete(id: string, session: Session): Promise<void> {
    this.logger.debug(`mutation delete unavailability`);
    const ua = await this.readOne(id, session);
    if (!ua) {
      throw new NotFoundException(
        'Unavailability not found',
        'unavailability.id'
      );
    }
    await this.db.deleteNode({
      session,
      object: ua,
      aclEditProp: 'canDeleteOwnUser',
    });
  }

  async list(
    { page, count, sort, order, filter }: UnavailabilityListInput,
    session: Session
  ): Promise<UnavailabilityListOutput> {
    const result = await this.db.list<Unavailability>({
      session,
      nodevar: 'unavailability',
      aclReadProp: 'canReadUnavailabilityList',
      aclEditProp: 'canCreateUnavailability',
      props: ['description', 'start', 'end'],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }
  async checkUnavailabilityConsistency(session: Session): Promise<boolean> {
    const unavailabilities = await this.db
      .query()
      .match([
        matchSession(session),
        [node('unavailability', 'Unavailability')],
      ])
      .return('unavailability.id as id')
      .run();

    return (
      (
        await Promise.all(
          unavailabilities.map(async (unavailability) => {
            return await this.db.hasProperties({
              session,
              id: unavailability.id,
              props: ['description', 'start', 'end'],
              nodevar: 'unavailability',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          unavailabilities.map(async (unavailability) => {
            return await this.db.isUniqueProperties({
              session,
              id: unavailability.id,
              props: ['description', 'start', 'end'],
              nodevar: 'unavailability',
            });
          })
        )
      ).every((n) => n)
    );
  }
}
