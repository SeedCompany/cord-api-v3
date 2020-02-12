import { Injectable, NotFoundException } from '@nestjs/common';
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
    @Logger('EducationService:service') private readonly logger: ILogger,
    private readonly propertyUpdater: PropertyUpdaterService,
  ) {}

  async create(
    input: CreateUnavailability,
    session: ISession,
  ): Promise<Unavailability> {
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
          canCreateUnavailability: true
        }),
        (targetUser:User {
          active: true,
          id: $targetUserId
        })
      CREATE
        (targetUser)
          -[:unavailability {active: true}]->
        (unavailability:Unavailability {
          id: $id,
          active: true,
          createdAt: datetime(),
          owningOrgId: $owningOrgId
        })
        -[:description {active: true}]->
        (description:description:Property {
          active: true,
          value: $description
        }),
        (unavailability)-[:start {active: true, createdAt: datetime()}]->
        (start:Property {
          active: true,
          value: $start
        }),
        (unavailability)-[:end {active: true, createdAt: datetime()}]->
        (end:Property {
          active: true,
          value: $end
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
          })-[:toNode]->(unavailability)
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
        acl.canEditEnd as canEditEnd
      `,
        {
          id: generate(),
          requestingUserId: session.userId,
          targetUserId: input.userId,
          token: session.token,
          description: input.description,
          start: input.start.toISO(),
          end: input.end.toISO(),
          owningOrgId: session.owningOrgId,
        },
      )
      .first();
    if (!result) {
      this.logger.error(
        `Could not create unavailability for user ${input.userId}`,
      );
      throw new Error('Could not create unavailability');
    }

    this.logger.info(
      `unavailability for user ${input.userId} created, id ${result.id}`,
    );

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
      throw new NotFoundException('Could not find language');
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
    userId: string,
    input: UnavailabilityListInput,
    session: ISession,
  ): Promise<SecuredUnavailabilityList> {
    throw new Error('Not implemented');
  }
}
