import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ILogger, Logger, PropertyUpdaterService } from '../../../core';
import { ISession } from '../../auth';
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
  ): Promise<UnavailabilityListOutput> {
    const result = await this.propertyUpdater.list<Unavailability>({
      session,
      nodevar: 'unavailability',
      aclReadProp: 'canReadUnavailabilityList',
      aclEditProp: 'canCreateUnavailability',
      props: [
        'description',
        'start',
        'end',
      ],
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
