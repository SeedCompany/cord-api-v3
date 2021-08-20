import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
} from '../../../common';
import { DtoRepository, matchRequestingUser } from '../../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
} from '../../../core/database/query';
import {
  CreateUnavailability,
  Unavailability,
  UnavailabilityListInput,
  UpdateUnavailability,
} from './dto';

@Injectable()
export class UnavailabilityRepository extends DtoRepository(Unavailability) {
  async create(input: CreateUnavailability, session: Session) {
    const initialProps = {
      description: input.description,
      start: input.start,
      end: input.end,
    };
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Unavailability, { initialProps }))
      .apply(
        createRelationships(Unavailability, 'in', {
          unavailability: ['User', input.userId],
        })
      )
      .return<{ id: ID }>('node.id as id');
    const result = await query.first();
    if (!result) {
      throw new ServerException('Could not create unavailability');
    }
    return result.id;
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Unavailability', { id })])
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find user', 'user.id');
    }

    return result.dto;
  }

  async getUserIdByUnavailability(
    session: Session,
    input: UpdateUnavailability
  ) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('user', 'User'),
        relation('out', '', 'unavailability', ACTIVE),
        node('unavailability', 'Unavailability', { id: input.id }),
      ])
      .return<{ id: ID }>('user.id as id')
      .first();
  }

  async list(
    { page, count, sort, order, filter }: UnavailabilityListInput,
    session: Session
  ) {
    return await this.db.list<Unavailability>({
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
  }
}
