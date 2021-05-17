import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  Property,
} from '../../core';
import { DbChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { Story, StoryListInput, UpdateStory } from './dto';

@Injectable()
export class StoryRepository {
  constructor(private readonly db: DatabaseService) {}

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
      .return('node.id as id')
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

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  getActualChanges(story: Story, input: UpdateStory) {
    return this.db.getActualChanges(Story, story, input);
  }

  async updateProperties(story: Story, simpleChanges: DbChanges<Story>) {
    await this.db.updateProperties({
      type: Story,
      object: story,
      changes: simpleChanges,
    });
  }

  async deleteNode(node: Story) {
    return void (await this.db.deleteNode(node));
  }

  list({ filter, ...input }: StoryListInput, session: Session) {
    return this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Story')])
      .apply(calculateTotalAndPaginateList(Story, input));
  }
}
