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
import { Injectable } from '@nestjs/common';
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
          id: $requestingUserId
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

    this.logger.info(`unavailability for user ${input.userId} created, id ${result.id}`)

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
    token: string,
  ): Promise<Unavailability> {
    throw new Error('Not implemented');
  }

  async delete(id: string, token: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async list(
    userId: string,
    input: UnavailabilityListInput,
    token: string,
  ): Promise<SecuredUnavailabilityList> {
    throw new Error('Not implemented');
  }
}
