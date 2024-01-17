import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { ChangesOf } from '~/core/database/changes';
import { ID, Session, UnsecuredDto } from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchProps,
  matchRequestingUser,
  merge,
  paginate,
  requestingUser,
  sorting,
} from '../../core/database/query';
import {
  CreateFieldRegion,
  FieldRegion,
  FieldRegionListInput,
  UpdateFieldRegion,
} from './dto';

@Injectable()
export class FieldRegionRepository extends DtoRepository(FieldRegion) {
  async create(input: CreateFieldRegion, session: Session) {
    const initialProps = {
      name: input.name,
      canDelete: true,
    };

    // create field region
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(FieldRegion, { initialProps }))
      .apply(
        createRelationships(FieldRegion, 'out', {
          director: ['User', input.directorId],
          zone: ['FieldZone', input.fieldZoneId],
        }),
      )
      .return<{ id: ID }>('node.id as id');

    return await query.first();
  }

  async update(
    existing: FieldRegion,
    changes: ChangesOf<FieldRegion, UpdateFieldRegion>,
  ) {
    const { directorId, ...simpleChanges } = changes;

    if (directorId) {
      // TODO update director - lol this was never implemented
    }

    await this.updateProperties(existing, simpleChanges);
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .optionalMatch([
          node('node'),
          relation('out', '', 'director', ACTIVE),
          node('director', 'User'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'zone', ACTIVE),
          node('fieldZone', 'FieldZone'),
        ])
        .return<{ dto: UnsecuredDto<FieldRegion> }>(
          merge('props', {
            director: 'director { .id }',
            fieldZone: 'fieldZone { .id }',
          }).as('dto'),
        );
  }

  async list({ filter, ...input }: FieldRegionListInput, session: Session) {
    const result = await this.db
      .query()
      .match(requestingUser(session))
      .match(node('node', 'FieldRegion'))
      .apply(sorting(FieldRegion, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
