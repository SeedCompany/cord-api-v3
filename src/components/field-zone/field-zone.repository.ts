import { Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
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
import { userFilters, userSorters } from '../user/user.repository';
import {
  type CreateFieldZone,
  FieldZone,
  FieldZoneFilters,
  type FieldZoneListInput,
  type UpdateFieldZone,
} from './dto';

@Injectable()
export class FieldZoneRepository extends DtoRepository(FieldZone) {
  async create(input: CreateFieldZone) {
    if (!(await this.isUnique(input.name))) {
      throw new DuplicateException(
        'name',
        'FieldZone with this name already exists.',
      );
    }

    const initialProps = {
      name: input.name,
      canDelete: true,
    };

    // create field zone
    const query = this.db
      .query()
      .apply(await createNode(FieldZone, { initialProps }))
      .apply(
        createRelationships(FieldZone, 'out', {
          director: ['User', input.director],
        }),
      )
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new CreationFailed(FieldZone);
    }

    return await this.readOne(result.id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(FieldZone)
        : e;
    });
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
        .return<{ dto: UnsecuredDto<FieldZone> }>(
          merge('props', {
            director: 'director { .id }',
          }).as('dto'),
        );
  }

  async update(input: UpdateFieldZone) {
    const { id, director, ...simpleChanges } = input;

    if (director) {
      await this.updateDirector(director, id);
    }

    await this.updateProperties({ id }, simpleChanges);

    return await this.readOne(id);
  }

  private async updateDirector(directorId: ID, id: ID) {
    const createdAt = DateTime.local();
    const query = this.db
      .query()
      .match(node('fieldZone', 'FieldZone', { id }))
      .with('fieldZone')
      .limit(1)
      .match([node('director', 'User', { id: directorId })])
      .optionalMatch([
        node('fieldZone'),
        relation('out', 'oldRel', 'director', ACTIVE),
        node(''),
      ])
      .setValues({ 'oldRel.active': false })
      .with('fieldZone, director')
      .limit(1)
      .create([
        node('fieldZone'),
        relation('out', '', 'director', {
          active: true,
          createdAt,
        }),
        node('director'),
      ]);

    await query.run();
  }

  async list(input: FieldZoneListInput) {
    if (!this.privileges.can('read')) {
      return SecuredList.Redacted;
    }
    const result = await this.db
      .query()
      .match(node('node', 'FieldZone'))
      .apply(fieldZoneFilters(input.filter))
      .apply(sortWith(fieldZoneSorters, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async readAllByDirector(id: ID<'User'>) {
    return await this.db
      .query()
      .match([
        node('node', 'FieldZone'),
        relation('out', '', 'director', ACTIVE),
        node('', 'User', { id }),
      ])
      .apply(this.hydrate())
      .map('dto')
      .run();
  }
}

export const fieldZoneFilters = filter.define(() => FieldZoneFilters, {
  id: filter.baseNodeProp(),
  director: filter.sub(() => userFilters)((sub) =>
    sub.match([
      node('outer'),
      relation('out', '', 'director', ACTIVE),
      node('node', 'User'),
    ]),
  ),
});

export const fieldZoneSorters = defineSorters(FieldZone, {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'director.*': (query, input) =>
    query
      .with('node as zone')
      .match([
        node('zone'),
        relation('out', '', 'director', ACTIVE),
        node('node', 'User'),
      ])
      .apply(sortWith(userSorters, input)),
});
