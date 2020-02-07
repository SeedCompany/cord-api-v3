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
import { generate } from 'shortid';

@Injectable()
export class UnavailabilityService {
  constructor(private readonly db: Connection) {}

  async list(
    userId: string,
    input: UnavailabilityListInput,
    token: string,
  ): Promise<SecuredUnavailabilityList> {
    throw new Error('Not implemented');
  }
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
          active: true,
          createdAt: datetime()
        })
        -[:description {active: true}]->
        (description:description:Property {
          active: true,
          value: $description
        }),
        (unavailability)-[:token {active: true, createdAt: datetime()}]->(token),
        (unavailability)-[:start {active: true, createdAt: datetime()}]->
        (start:Property {
          active: true,
          value: $start
        }),
        (unavailability)-[:end {active: true, createdAt: datetime()}]->
        (end:Property {
          active: true,
          value: $end
        })
      RETURN
      unavailability.id as token.userId,
      description.value as description,
        start.value as start,
        end.value as end,
      `,
        {
          id: token.userId,
          token: token.token,
          description: input.description,
          start: input.start,
          end: input.end,
        },
      )
      .first();
    if (!result) {
      console.log('KKKK');
      throw new Error('Could not create user');
    }
    console.log('token', token);

    return {
      id: result.id,
      createdAt: DateTime.local(), // TODO
      description: result.description,
      start: result.start,
      end: result.end,
      canRead: true,
      canEdit: true,
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
}
