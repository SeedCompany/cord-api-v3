import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, NotFoundException, ServerException } from '~/common';
import { DtoRepository } from '~/core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  paginate,
  sorting,
} from '~/core/database/query';
import {
  CreateUnavailability,
  Unavailability,
  UnavailabilityListInput,
  UpdateUnavailability,
} from './dto';

@Injectable()
export class UnavailabilityRepository extends DtoRepository(Unavailability) {
  async create(input: CreateUnavailability) {
    const initialProps = {
      description: input.description,
      start: input.start,
      end: input.end,
    };
    const query = this.db
      .query()
      .apply(await createNode(Unavailability, { initialProps }))
      .apply(
        createRelationships(Unavailability, 'in', {
          unavailability: ['User', input.userId],
        }),
      )
      .return<{ id: ID }>('node.id as id');
    const result = await query.first();
    if (!result) {
      throw new ServerException('Could not create unavailability');
    }
    return await this.readOne(result.id);
  }

  async update(changes: UpdateUnavailability) {
    const { id, ...simpleChanges } = changes;
    await this.updateProperties({ id }, simpleChanges);
    return await this.readOne(id);
  }

  async getUserIdByUnavailability(id: ID) {
    const result = await this.db
      .query()
      .match([
        node('user', 'User'),
        relation('out', '', 'unavailability', ACTIVE),
        node('unavailability', 'Unavailability', { id }),
      ])
      .return<{ id: ID }>('user.id as id')
      .first();

    if (!result) {
      throw new NotFoundException(
        'Could not find user associated with unavailability',
        'user.unavailability',
      );
    }
    return result;
  }

  async list(input: UnavailabilityListInput) {
    const result = await this.db
      .query()
      .matchNode('node', 'Unavailability')
      .apply(sorting(Unavailability, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate will always have 1 row.
  }
}
