import { Injectable, NotFoundException } from '@nestjs/common';
import { generate } from 'shortid';
import { ISession } from '../../../common';
import { DatabaseService, ILogger, Logger } from '../../../core';
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
    @Logger('UnavailabilityService:service') private readonly logger: ILogger,
    private readonly db: DatabaseService
  ) {}

  async create(
    { userId, ...input }: CreateUnavailability,
    session: ISession
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
      await this.db.createNode({
        session,
        type: Unavailability.classType,
        input: { id, ...input },
        acls,
      });
    } catch {
      this.logger.error(`Could not create unavailability`, {
        id,
        userId,
      });
      throw new Error('Could not create unavailability');
    }

    this.logger.info(`Created user unavailability`, {
      id,
      userId,
    });

    // connect the Unavailability to the User.

    const query = `
    MATCH (user: User {id: $userId, active: true}),
      (unavailability:Unavailability {id: $id, active: true})
    CREATE (user)-[:unavailability {active: true, createdAt: datetime()}]->(unavailability)
    RETURN  unavailability.id as id
    `;
    await this.db
      .query()
      .raw(query, {
        userId,
        id,
      })
      .first();

    return await this.readOne(id, session);
  }

  async readOne(id: string, session: ISession): Promise<Unavailability> {
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
          owningOrgId: $owningOrgId
        }),
        (unavailability:Unavailability {active: true, id: $id})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl1:ACL {canReadDescription: true})-[:toNode]->(unavailability)-[:description {active: true}]->(description:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl2:ACL {canEditDescription: true})-[:toNode]->(unavailability)
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl3:ACL {canReadStart: true})-[:toNode]->(unavailability)-[:start {active: true}]->(start:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl4:ACL {canEditStart: true})-[:toNode]->(unavailability)
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl5:ACL {canReadEnd: true})-[:toNode]->(unavailability)-[:end {active: true}]->(end:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl6:ACL {canEditEnd: true})-[:toNode]->(unavailability)
        RETURN
          unavailability.id as id,
          unavailability.createdAt as createdAt,
          description.value as description,
          acl1.canReadDescription as canReadDescription,
          acl2.canEditDescription as canEditDescription,
          start.value as start,
          acl3.canReadStart as canReadStart,
          acl4.canEditStart as canEditStart,
          end.value as end,
          acl5.canReadEnd as canReadEnd,
          acl6.canEditEnd as canEditEnd
        `,
        {
          token: session.token,
          requestingUserId: session.userId,
          owningOrgId: session.owningOrgId,
          id,
        }
      )
      .first();
    if (!result) {
      throw new NotFoundException('Could not find unavailability');
    }

    return {
      id,
      createdAt: result.createdAt,
      description: {
        value: result.description,
        canRead:
          result.canReadDescription !== null
            ? result.canReadDescription
            : false,
        canEdit:
          result.canEditDescription !== null
            ? result.canEditDescription
            : false,
      },
      start: {
        value: result.start,
        canRead: result.canReadStart !== null ? result.canReadStart : false,
        canEdit: result.canEditStart !== null ? result.canEditStart : false,
      },
      end: {
        value: result.end,
        canRead: result.canReadEnd !== null ? result.canReadEnd : false,
        canEdit: result.canEditEnd !== null ? result.canEditEnd : false,
      },
    };
  }

  async update(
    input: UpdateUnavailability,
    session: ISession
  ): Promise<Unavailability> {
    const unavailability = await this.readOne(input.id, session);

    return this.db.updateProperties({
      session,
      object: unavailability,
      props: ['description', 'start', 'end'],
      changes: input,
      nodevar: 'unavailability',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    this.logger.info(`mutation delete unavailability`);
    const ua = await this.readOne(id, session);
    if (!ua) {
      throw new NotFoundException('Unavailability not found');
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
}
