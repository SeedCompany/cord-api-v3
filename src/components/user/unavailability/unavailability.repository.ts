import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, ServerException, Session } from '../../../common';
import { DtoRepository, matchRequestingUser } from '../../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../../core/database/query';
import {
  CreateUnavailability,
  Unavailability,
  UnavailabilityListInput,
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

  async getUserIdByUnavailability(id: ID) {
    return await this.db
      .query()
      .match([
        node('user', 'User'),
        relation('out', '', 'unavailability', ACTIVE),
        node('unavailability', 'Unavailability', { id }),
      ])
      .return<{ id: ID }>('user.id as id')
      .first();
  }

  async list(input: UnavailabilityListInput, session: Session) {
    const result = await this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Unavailability')])
      .apply(sorting(Unavailability, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate will always have 1 row.
  }
}
