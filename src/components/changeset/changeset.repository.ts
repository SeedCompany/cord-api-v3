import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../common';
import { DtoRepository } from '../../core';
import { matchProps } from '../../core/database/query';
import { BaseNode, DbPropsOfDto } from '../../core/database/results';
import { Changeset, ChangesetDiff } from './dto';

@Injectable()
export class ChangesetRepository extends DtoRepository(Changeset) {
  async readOne(id: ID): Promise<Changeset> {
    const query = this.db
      .query()
      .match([
        node('node', 'Changeset', { id }),
        relation('in', '', 'changeset', { active: true }),
        node('parent', 'BaseNode'),
      ])
      .apply(matchProps())
      .return([
        'props',
        `[l in labels(node) where not l in ['Changeset', 'BaseNode']][0] as type`,
      ])
      .asResult<{
        props: DbPropsOfDto<Changeset, true>;
        type: string;
      }>();
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Changeset not found');
    }
    return {
      ...result.props,
      __typename: result.type,
      canDelete: false,
    };
  }

  async difference(id: ID, _session: Session) {
    const result = await this.db
      .query()
      .match([node('changeset', 'ProjectChangeRequest', { id })])
      .subQuery((sub) =>
        sub
          .with('changeset')
          .match([
            node('changeset'),
            relation('out', '', [], { active: true }),
            node('', 'Property'),
            relation('in', '', []),
            node('node', 'BaseNode'),
          ])
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
