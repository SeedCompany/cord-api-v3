import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { ISession, NotFoundException, ServerException } from '../../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
} from '../../../core';
import { matchPermList, matchPropList } from '../../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parseSecuredProperties,
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
    private readonly authorizationService: AuthorizationService
  ) {}

  async create(
    { userId, ...input }: CreateUnavailability,
    session: ISession
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
        .match([
          node('root', 'User', {
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(
          createBaseNode,
          'Unavailability',
          secureProps,
          {},
          [],
          session.userId === this.config.rootAdmin.id
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

      const dbUnavailability = new DbUnavailability();
      await this.authorizationService.processNewBaseNode(
        dbUnavailability,
        createUnavailabilityResult.id,
        session.userId as string
      );

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

      return await this.readOne(createUnavailabilityResult.id, session);
    } catch {
      this.logger.error(`Could not create unavailability`, {
        userId,
      });
      throw new ServerException('Could not create unavailability');
    }
  }

  async readOne(id: string, session: ISession): Promise<Unavailability> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Unavailability', { id })])
      .call(matchPermList, 'requestingUser')
      .call(matchPropList, 'permList')
      .return('propList, permList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Unavailability>>>();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find user', 'user.id');
    }

    const securedProps = parseSecuredProperties(
      result.propList,
      result.permList,
      {
        description: true,
        start: true,
        end: true,
      }
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
    };
  }

  async update(
    input: UpdateUnavailability,
    session: ISession
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

  async delete(id: string, session: ISession): Promise<void> {
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
    session: ISession
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
  async checkUnavailabilityConsistency(session: ISession): Promise<boolean> {
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
