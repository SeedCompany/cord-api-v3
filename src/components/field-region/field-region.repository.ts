import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { ID, NotFoundException, Session, UnsecuredDto } from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  createNode,
  createRelationships,
  matchProps,
  merge,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { CreateFieldRegion, FieldRegion, FieldRegionListInput } from './dto';

@Injectable()
export class FieldRegionRepository extends DtoRepository(FieldRegion) {
  async checkName(name: string) {
    return await this.db
      .query()
      .match([node('name', 'FieldRegionName', { value: name })])
      .return('name')
      .first();
  }

  async create(session: Session, input: CreateFieldRegion) {
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
        createRelationships(FieldRegion, {
          out: {
            director: ['User', input.directorId],
            zone: ['FieldZone', input.fieldZoneId],
          },
        })
      )
      .return<{ id: ID }>('node.id as id');

    return await query.first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'FieldRegion', { id: id })])
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find field region',
        'fieldRegion.id'
      );
    }
    return result.dto;
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .optionalMatch([
          node('node'),
          relation('out', '', 'director', { active: true }),
          node('director', 'User'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'zone', { active: true }),
          node('fieldZone', 'FieldZone'),
        ])
        .return<{ dto: UnsecuredDto<FieldRegion> }>(
          merge('props', {
            director: 'director.id',
            fieldZone: 'fieldZone.id',
          }).as('dto')
        );
  }

  async list({ filter, ...input }: FieldRegionListInput, session: Session) {
    const label = 'FieldRegion';
    const result = await this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .apply(sorting(FieldRegion, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
