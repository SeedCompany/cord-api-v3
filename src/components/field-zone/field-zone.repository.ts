import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ChangesOf } from '~/core/database/changes';
import {
  DuplicateException,
  ID,
  SecuredList,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
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
  CreateFieldZone,
  FieldZone,
  FieldZoneListInput,
  UpdateFieldZone,
} from './dto';

@Injectable()
export class FieldZoneRepository extends DtoRepository(FieldZone) {
  async create(input: CreateFieldZone, session: Session) {
    if (!(await this.isUnique(input.name))) {
      throw new DuplicateException(
        'fieldZone.name',
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
      .apply(matchRequestingUser(session))
      .apply(await createNode(FieldZone, { initialProps }))
      .apply(
        createRelationships(FieldZone, 'out', {
          director: ['User', input.directorId],
        }),
      )
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('failed to create field zone');
    }

    return await this.readOne(result.id);
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

  async update(
    existing: Pick<FieldZone, 'id'>,
    changes: ChangesOf<FieldZone, UpdateFieldZone>,
  ) {
    const { directorId, ...simpleChanges } = changes;

    if (directorId) {
      await this.updateDirector(directorId, existing.id);
    }

    await this.updateProperties(existing, simpleChanges);

    return await this.readOne(existing.id);
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

  async list({ filter, ...input }: FieldZoneListInput, session: Session) {
    if (!this.privileges.forUser(session).can('read')) {
      return SecuredList.Redacted;
    }
    const result = await this.db
      .query()
      .match(requestingUser(session))
      .match(node('node', 'FieldZone'))
      .apply(sorting(FieldZone, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
