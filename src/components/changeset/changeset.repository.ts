import { Injectable } from '@nestjs/common';
import { hasLabel, node, not, relation } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../common';
import { DtoRepository } from '../../core';
import { ACTIVE } from '../../core/database/query';
import { BaseNode } from '../../core/database/results';
import { Changeset, ChangesetDiff } from './dto';

@Injectable()
export class ChangesetRepository extends DtoRepository(Changeset) {
  async difference(id: ID, _session: Session) {
    const result = await this.db
      .query()
      .match([node('changeset', 'Changeset', { id })])
      .subQuery((sub) =>
        sub
          .with('changeset')
          .match([
            node('changeset'),
            relation('out', '', [], ACTIVE),
            node('', 'Property'),
            relation('in', 'prop'),
            node('node', 'BaseNode'),
          ])
          // Ignore modifiedAt properties when determining if a node has changed.
          // These are not directly modified by user, and could be left over
          // if a user made a change and then reverted it.
          .where(not({ prop: hasLabel('modifiedAt') }))
          .return('collect(distinct node) as changed')
      )
      .subQuery((sub) =>
        sub
          .with('changeset')
          .optionalMatch([
            node('changeset'),
            relation('out', '', [], { active: true, deleting: true }),
            node('deletingNode', 'BaseNode'),
          ])
          .optionalMatch([
            node('changeset', 'Changeset', { id }),
            relation('out', '', [], { deleting: true }),
            node('deletedNode', 'Deleted_BaseNode'),
          ])
          .return('collect(deletingNode) + collect(deletedNode) as removed')
      )
      .return<Record<keyof ChangesetDiff, readonly BaseNode[]>>([
        'changed',
        'removed',
        '[(changeset)-[changeType:changeset { active: true }]->(node:BaseNode) WHERE changeType.deleting IS NULL | node] as added',
      ])
      .first();
    if (!result) {
      throw new NotFoundException('Could not find changeset');
    }
    return result;
  }
}
