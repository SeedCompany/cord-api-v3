import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, NotFoundException } from '../../common';
import { DtoRepository } from '../../core';
import { matchProps } from '../../core/database/query';
import { DbPropsOfDto } from '../../core/database/results';
import { Changeset } from './dto';

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
}
