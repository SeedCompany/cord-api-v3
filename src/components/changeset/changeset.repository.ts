import { Injectable } from '@nestjs/common';
import { hasLabel, node, not, relation } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../common';
import { DtoRepository } from '../../core';
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
            relation('out', '', [], { active: true }),
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
          .match([
            node('changeset'),
            relation('out', '', 'changeset', { active: true }),
            node('node', 'BaseNode'),
          ])
          .return('collect(distinct node) as added')
      )
      .return<Record<keyof ChangesetDiff, readonly BaseNode[]>>([
        'changed',
        'added',
        '[] as removed',
      ])
      .first();
    if (!result) {
      throw new NotFoundException('Could not find changeset');
    }
    return result;
  }
}
