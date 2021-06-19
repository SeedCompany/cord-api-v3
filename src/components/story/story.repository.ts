import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { Story, StoryListInput } from './dto';

@Injectable()
export class StoryRepository extends DtoRepository(Story) {
  async checkStory(name: string) {
    return await this.db
      .query()
      .match([node('story', 'StoryName', { value: name })])
      .return('story')
      .first();
  }

  async create(session: Session, secureProps: Property[]) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(
        createBaseNode(await generateId(), ['Story', 'Producible'], secureProps)
      )
      .return<{ id: ID }>('node.id as id')
      .first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Story', { id })])
      .apply(matchPropList)
      .return('node, propList')
      .asResult<StandardReadResult<DbPropsOfDto<Story>>>();

    return await query.first();
  }

  list({ filter, ...input }: StoryListInput, session: Session) {
    return this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Story')])
      .apply(calculateTotalAndPaginateList(Story, input));
  }
}
