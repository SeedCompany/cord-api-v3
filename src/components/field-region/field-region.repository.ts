import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import {
  DuplicateException,
  ID,
  SecuredList,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchProps,
  merge,
  paginate,
  requestingUser,
  sorting,
} from '~/core/database/query';
import {
  CreateFieldRegion,
  FieldRegion,
  FieldRegionListInput,
  UpdateFieldRegion,
} from './dto';

@Injectable()
export class FieldRegionRepository extends DtoRepository(FieldRegion) {
  async create(input: CreateFieldRegion) {
    if (!(await this.isUnique(input.name))) {
      throw new DuplicateException(
        'fieldRegion.name',
        'FieldRegion with this name already exists.',
      );
    }

    const initialProps = {
      name: input.name,
      canDelete: true,
    };

    // create field region
    const query = this.db
      .query()
      .apply(await createNode(FieldRegion, { initialProps }))
      .apply(
        createRelationships(FieldRegion, 'out', {
          director: ['User', input.directorId],
          zone: ['FieldZone', input.fieldZoneId],
        }),
      )
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('failed to create field region');
    }

    return await this.readOne(result.id);
  }

  async update(changes: UpdateFieldRegion) {
    const { id, directorId, fieldZoneId, ...simpleChanges } = changes;

    if (directorId) {
      // TODO update director - lol this was never implemented
    }

    if (fieldZoneId) {
      // TODO update field zone - neither was this
    }

    await this.updateProperties({ id }, simpleChanges);

    return await this.readOne(id);
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
    if (!this.privileges.forUser(session).can('read')) {
      return SecuredList.Redacted;
    }
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
