import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { generateId, ID, NotFoundException, Session } from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
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
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find story', 'story.id');
    }
    return result.dto;
  }

  async list({ filter, ...input }: StoryListInput, session: Session) {
    const result = await this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Story')])
      .apply(sorting(Story, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
