import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ILogger, Logger, PropertyUpdaterService } from '../../../core';
import { ISession } from '../../auth';
import {
  CreateUnavailability,
  SecuredUnavailabilityList,
  Unavailability,
  UnavailabilityListInput,
  UpdateUnavailability,
} from './dto';

@Injectable()
export class UnavailabilityService {
  constructor(
    private readonly db: Connection,
    @Logger('UnavailabilityService:service') private readonly logger: ILogger,
    private readonly propertyUpdater: PropertyUpdaterService,
  ) {}

  async create(
    input: CreateUnavailability,
    session: ISession,
  ): Promise<Unavailability> {
    const id = generate();
    const acls = {
      canReadDescription: true,
      canEditDescription: true,
      canReadStart: true,
      canEditStart: true,
      canReadEnd: true,
      canEditEnd: true,
    };
    try {
      await this.propertyUpdater.createNode({
        session,
        input: { id, ...input },
        acls,
        baseNodeLabel: 'Unavailability',
        aclEditProp: 'canCreateUnavailability',
      });
    } catch {
      this.logger.error(
        `Could not create unavailability for user ${input.userId}`,
      );
      throw new Error('Could not create unavailability');
    }

    this.logger.info(
      `unavailability for user ${input.userId} created, id ${id}`,
    );
    console.log(`unavailability for user ${input.userId} created, id ${id}`);

    // connect the Unavailability to the User.

    const query = `
    MATCH (user: User {id: $userId, active: true}),
      (unavailability:Unavailability {id: $id, active: true})
    CREATE (user)-[:unavailability {active: true, createdAt: datetime()}]->(unavailability)
    RETURN  unavailability.id as id
    `;
    const result = await this.db
      .query()
      .raw(query, {
        userId: session.userId,
        id,
      })
      .first();

    return await this.readOne(id, session);
  }

  async readOne(id: string, session: ISession): Promise<Unavailability> {
    this.logger.info(
      `Query readOne Unavailability: id ${id} by ${session.userId}`,
    );
    const result = await this.db
      .query()
      .raw(
        `
      MATCH
        (token:Token {
          active: true,
          value: $token
        })
        <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId,
          canReadUnavailability: true
        }),
        (unavailability:Unavailability {
          active: true,
          id: $id
        }),
        (requestingUser)
          <-[:member]-
          (acl:ACL {
            canReadDescription: true,
            canEditDescription: true,
            canReadStart: true,
            canEditStart: true,
            canReadEnd: true,
            canEditEnd: true
          })-[:toNode]->(unavailability),
          (unavailability)-[:description {active: true}]->(description:Property {active: true}),
          (unavailability)-[:start {active: true}]->(start:Property {active: true}),
          (unavailability)-[:end {active: true}]->(end:Property {active: true})
      RETURN
        unavailability.id as id,
        description.value as description,
        start.value as start,
        end.value as end,
        acl.canReadDescription as canReadDescription,
        acl.canEditDescription as canEditDescription,
        acl.canReadStart as canReadStart,
        acl.canEditStart as canEditStart,
        acl.canReadEnd as canReadEnd,
        acl.canEditEnd as canEditEnd,
        requestingUser.canReadUnavailability as canReadUnavailability
      `,
        {
          id,
          token: session.token,
          requestingUserId: session.userId,
        },
      )
      .first();

    if (!result) {
      this.logger.error(`Could not find unavailability: ${id} `);
      throw new NotFoundException(`Could not find unavailability ${id}`);
    }

    if (!result.canReadUnavailability) {
      throw new Error(
        'User does not have permission to read these unavailabilities',
      );
    }
    return {
      id: result.id,
      createdAt: DateTime.local(), // TODO
      description: {
        value: result.description,
        canRead: result.canReadDescription,
        canEdit: result.canEditDescription,
      },
      start: {
        value: result.start,
        canRead: result.canReadStart,
        canEdit: result.canEditStart,
      },
      end: {
        value: result.end,
        canRead: result.canReadEnd,
        canEdit: result.canEditEnd,
      },
    };
  }

  async update(
    input: UpdateUnavailability,
    session: ISession,
  ): Promise<Unavailability> {
    const unavailability = await this.readOne(input.id, session);

    return this.propertyUpdater.updateProperties({
      session,
      object: unavailability,
      props: ['description', 'start', 'end'],
      changes: input,
      nodevar: 'unavailability',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    this.logger.info(
      `mutation delete unavailability: ${id} by ${session.userId}`,
    );
    const ua = await this.readOne(id, session);
    if (!ua) {
      throw new NotFoundException('Unavailability not found');
    }
    try {
      this.propertyUpdater.deleteNode({
        session,
        object: ua,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async list(
    { page, count, sort, order, filter }: UnavailabilityListInput,
    session: ISession,
  ): Promise<SecuredUnavailabilityList> {
    if (!filter?.userId) {
      throw new BadRequestException('no userId specified');
    }
    const query = `
      MATCH
        (token:Token {
          active: true,
          value: $token
        })
          <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId,
          owningOrgId: $owningOrgId
        }),
        (user: User {owningOrgId: $owningOrgId, active: true, id: $userId} )
          -[:unavailability {active: true}]
          ->(unavailability:Unavailability {active: true})
      WITH count(unavailability) as total, unavailability
      MATCH
        (requestingUser)<-[:member]-(acl:ACL {canReadDescription: true, canReadStart: true, canReadEnd: true})-[:toNode]->(unavailability),
        (unavailability)-[:description {active: true}]->(description:Property {active: true}),
        (unavailability)-[:start {active: true}]->(start:Property {active: true}),
        (unavailability)-[:end {active: true}]->(end:Property {active: true})
        RETURN
          total,
          unavailability.id as id,
          unavailability.createdAt as createdAt,
          description.value as description,
          acl.canReadDescription as canReadDescription,
          acl.canEditDescription as canEditDescription,
          start.value as start,
          acl.canReadStart as canReadStart,
          acl.canEditStart as canEditStart,
          end.value as end,
          acl.canReadEnd as canReadEnd,
          acl.canEditEnd as canEditEnd,
          requestingUser.canReadUnavailability,
          requestingUser.canCreateUnavailability
        ORDER BY ${sort} ${order}
        SKIP $skip
        LIMIT $count
      `;

    const result = await this.db
      .query()
      .raw(query, {
        userId: filter.userId,
        requestingUserId: session.userId,
        owningOrgId: session.owningOrgId,
        skip: (page - 1) * count,
        count,
        token: session.token,
      })
      .run();

    const items = result.map<Unavailability>(row => ({
      id: row.id,
      createdAt: row.createdAt,
      description: {
        value: row.description,
        canRead: row.canReadDescription !== null ? row.canReadDescription : false,
        canEdit: row.canEditDescription !== null ? row.canEditDescription : false,
      },
      start: {
        value: row.start,
        canRead: row.canReadStart !== null ? row.canReadStart : false,
        canEdit: row.canEditStart !== null ? row.canEditStart : false,
      },
      end: {
        value: row.end,
        canRead:
          row.canReadEnd !== null ? row.canReadEnd : false,
        canEdit:
          row.canEditEnd !== null ? row.canEditEnd : false,
      },
    }));

    const hasMore = result ? (page - 1) * count + count < result[0].total : false ; // if skip + count is less than total there is more

    return {
      items,
      hasMore,
      total: result ? result[0].total : 0,
      canCreate: result ? result[0].canCreateUnavailability : false,
      canRead: result ? result[0].canReadUnavailability : false,
    };
  }
}
