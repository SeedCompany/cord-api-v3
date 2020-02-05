import { Injectable } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { generate } from 'shortid';
import { DateTime } from 'luxon';

import {
  CreateUnavailability,
  SecuredUnavailabilityList,
  Unavailability,
  UnavailabilityListInput,
  UpdateUnavailability,
} from './dto';

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
    token: string,
  ): Promise<Unavailability> {
    const result = await this.db
      .query()
      .raw(
        `
      MATCH (token:Token {active: true, value: $token})
      CREATE
        (unavailability:Unavailability {
          id: 'BEUCYk9B',
          active: true,
          createdAt: datetime(),
          canCreateOrg: true,
          canReadOrgs: true
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
      unavailability.id as userId,
      description.value as description,
        start.value as start,
        end.value as end,
      `,
        {
          id: input.userId,
          token,
          description: input.description,
          start: input.start,
          end: input.end,
        },
      )
      .first();
    if (!result) {
      throw new Error('Could not create user');
    }

    return {
      id: result.userId,
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
