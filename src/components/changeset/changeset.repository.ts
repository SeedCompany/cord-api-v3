import { Injectable } from '@nestjs/common';
import { hasLabel, node, not, relation } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  matchParentToSelfOrChildNode,
} from '../../core/database/query';
import { BaseNode } from '../../core/database/results';
import { ProjectChangeRequestStatus } from '../project-change-request/dto';
import { Changeset, ChangesetDiff } from './dto';

@Injectable()
export class ChangesetRepository extends DtoRepository(Changeset) {
  async difference(id: ID, _session: Session, parent: ID) {
    const result = await this.db
      .query()
      .match([node('changeset', 'Changeset', { id })])
      .match([node('parent', { id: parent })])
      .subQuery((sub) =>
        sub
          .with(['changeset', 'parent'])
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
          .apply(matchParentToSelfOrChildNode())
          .return('collect(distinct selfOrChild) as changed')
      )
      .subQuery((sub) =>
        sub
          .with(['changeset', 'parent'])
          .match([
            node('changeset'),
            relation('out', '', [], { deleting: true }),
            node('node'),
          ])
          .apply(matchParentToSelfOrChildNode())
          .return('collect(distinct selfOrChild) as removed')
      )
      .subQuery((sub) =>
        sub
          .with(['changeset', 'parent'])
          .match([
            node('changeset'),
            relation('out', 'changeType', 'changeset', { ACTIVE }),
            node('node', 'BaseNode'),
          ])
          .raw('WHERE changeType.deleting IS NULL')
          .apply(matchParentToSelfOrChildNode())
          .return('collect(distinct selfOrChild) as added')
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

  async isApproved(id: ID, _session: Session) {
    const result = await this.db
      .query()
      .match([
        node('changeset', 'Changeset', { id }),
        relation('out', '', 'status', ACTIVE),
        node('status', 'Property'),
      ])
      .where({
        status: {
          value: ProjectChangeRequestStatus.Approved,
        },
      })
      .return('changeset.id')
      .first();
    return !!result;
  }
}
