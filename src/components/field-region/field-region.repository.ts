import { Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import {
  CreationFailed,
  DuplicateException,
  type ID,
  NotFoundException,
  ReadAfterCreationFailed,
  SecuredList,
  type UnsecuredDto,
} from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  defineSorters,
  filter,
  matchProps,
  merge,
  paginate,
  sortWith,
} from '~/core/database/query';
import {
  fieldZoneFilters,
  fieldZoneSorters,
} from '../field-zone/field-zone.repository';
import { userFilters, userSorters } from '../user/user.repository';
import {
  type CreateFieldRegion,
  FieldRegion,
  FieldRegionFilters,
  type FieldRegionListInput,
  type UpdateFieldRegion,
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
      throw new CreationFailed(FieldRegion);
    }

    return await this.readOne(result.id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(FieldRegion)
        : e;
    });
  }

  async update(changes: UpdateFieldRegion) {
    const { id, directorId, fieldZoneId, ...simpleChanges } = changes;
    await this.updateProperties({ id }, simpleChanges);

    if (directorId !== undefined) {
      await this.updateRelation('director', 'User', id, directorId);
    }

    if (fieldZoneId !== undefined) {
      await this.updateRelation('zone', 'FieldZone', id, fieldZoneId);
    }

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

  async list(input: FieldRegionListInput) {
    if (!this.privileges.can('read')) {
      return SecuredList.Redacted;
    }
    const result = await this.db
      .query()
      .match(node('node', 'FieldRegion'))
      .apply(fieldRegionFilters(input.filter))
      .apply(sortWith(fieldRegionSorters, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async readAllByDirector(id: ID<'User'>) {
    return await this.db
      .query()
      .match([
        node('node', 'FieldRegion'),
        relation('out', '', 'director', ACTIVE),
        node('', 'User', { id }),
      ])
      .apply(this.hydrate())
      .map('dto')
      .run();
  }
}

export const fieldRegionFilters = filter.define(() => FieldRegionFilters, {
  id: filter.baseNodeProp(),
  director: filter.sub(() => userFilters)((sub) =>
    sub.match([
      node('outer'),
      relation('out', '', 'director', ACTIVE),
      node('node', 'User'),
    ]),
  ),
  fieldZone: filter.sub(() => fieldZoneFilters)((sub) =>
    sub.match([
      node('outer'),
      relation('out', '', 'zone', ACTIVE),
      node('node', 'FieldZone'),
    ]),
  ),
});

export const fieldRegionSorters = defineSorters(FieldRegion, {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'director.*': (query, input) =>
    query
      .with('node as region')
      .match([
        node('region'),
        relation('out', '', 'director', ACTIVE),
        node('node', 'User'),
      ])
      .apply(sortWith(userSorters, input)),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'fieldZone.*': (query, input) =>
    query
      .with('node as region')
      .match([
        node('region'),
        relation('out', '', 'zone', ACTIVE),
        node('node', 'FieldZone'),
      ])
      .apply(sortWith(fieldZoneSorters, input)),
});
