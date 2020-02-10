import {
  CreateUnavailability,
  SecuredUnavailabilityList,
  Unavailability,
  UnavailabilityListInput,
  UpdateUnavailability,
} from './dto';

import { Connection } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { IRequestUser } from '../../../common/request-user.interface';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Logger, ILogger } from '../../../core/logger';
import { generate } from 'shortid';
import { PropertyUpdaterService } from '../../../core';

@Injectable()
export class UnavailabilityService {
  constructor(
    private readonly db: Connection,
    @Logger('EducationService:service') private readonly logger: ILogger,
    private readonly propertyUpdater: PropertyUpdaterService,
  ) {}

  async create(
    input: CreateUnavailability,
    token: IRequestUser,
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
          requestingUserId: token.userId,
          targetUserId: input.userId,
          token: token.token,
          description: input.description,
          start: input.start.toISO(),
          end: input.end.toISO(),
          owningOrgId: token.owningOrgId,
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

  async readOne(id: string, token: IRequestUser): Promise<Unavailability> {
    this.logger.info(
      `Query readOne Unavailability: id ${id} by ${token.userId}`,
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
          token: token.token,
          requestingUserId: token.userId,
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
    token: IRequestUser,
  ): Promise<Unavailability> {
    const unavailability = await this.readOne(input.id, token);

    return this.propertyUpdater.updateProperties({
      token,
      object: unavailability,
      props: ['description', 'start', 'end'],
      changes: input,
      nodevar: 'unavailability',
    });
  }

  async delete(id: string, token: IRequestUser): Promise<void> {
    this.logger.info(
      `mutation delete unavailability: ${id} by ${token.userId}`,
    );
    const result = await this.db
      .query()
      .raw(
        `
      MATCH
        (token:Token {active: true, value: $token})
          <-[:token {active: true}]-
          (user:User {
            canCreateUnavailability: true
          }),
        (unavailability:Unavailability {active: true, id: $id})
      SET
        unavailability.active = false
      RETURN
        unavailability.id as id
      `,
        {
          id,
          token: token.token,
        },
      )
      .first();

    if (!result) {
      this.logger.error(
        `Could not find unavailability ${id}. Might not be active`,
      );
      throw new NotFoundException(`Could not find unavailability`);
    }
  }

  async list(
    userId: string,
    input: UnavailabilityListInput,
    token: IRequestUser,
  ): Promise<SecuredUnavailabilityList> {
    throw new Error('Not implemented');
  }
}
