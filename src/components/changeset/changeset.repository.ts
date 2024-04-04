import { Injectable } from '@nestjs/common';
import {
  equals,
  hasLabel,
  isNull,
  node,
  not,
  or,
  relation,
} from 'cypher-query-builder';
import { ID, NotFoundException } from '~/common';
import { DtoRepository } from '~/core/database';
import { ACTIVE, path, variable } from '~/core/database/query';
import { BaseNode } from '~/core/database/results';
import { Changeset, ChangesetDiff } from './dto';

@Injectable()
export class ChangesetRepository extends DtoRepository(Changeset) {
  async difference(id: ID, parent?: ID) {
    const importVars = ['changeset', ...(parent ? ['parent'] : [])];
    const limitToParentSubTree = parent
      ? {
          node: or([
            equals('parent', true),
            path([
              node('parent'),
              relation('out', undefined, undefined, undefined, '*'),
              node('node'),
            ]),
          ]),
        }
      : {};

    const result = await this.db
      .query()
      .match([
        [node('changeset', 'Changeset', { id })],
        ...(parent ? [[node('parent', 'BaseNode', { id: parent })]] : []),
      ])
      .subQuery(importVars, (sub) =>
        sub
          .match([
            node('changeset'),
            relation('out', '', [], ACTIVE),
            node('', 'Property'),
            relation('in', 'prop'),
            node('node', 'BaseNode'),
          ])
          .where({
            // Ignore modifiedAt properties when determining if a node has changed.
            // These are not directly modified by user, and could be left over
            // if a user made a change and then reverted it.
            prop: not(hasLabel('modifiedAt')),
            ...limitToParentSubTree,
          })
          .return('collect(distinct node) as changed'),
      )
      .subQuery(importVars, (sub) =>
        sub
          .match([
            node('changeset'),
            relation('out', '', [], { deleting: variable('true') }),
            node('node'),
          ])
          .apply((q) => (parent ? q.where(limitToParentSubTree) : q))
          .return('collect(distinct node) as removed'),
      )
      .subQuery(importVars, (sub) =>
        sub
          .match([
            node('changeset'),
            relation('out', 'changeType', 'changeset', ACTIVE),
            node('node', 'BaseNode'),
          ])
          .where({
            changeType: { deleting: isNull() },
            ...limitToParentSubTree,
          })
          .return('collect(distinct node) as added'),
      )
      .return<Record<keyof ChangesetDiff, readonly BaseNode[]>>([
        'changed',
        'removed',
        'added',
      ])
      .first();
    if (!result) {
      throw new NotFoundException('Could not find changeset');
    }
    return result;
  }
}
