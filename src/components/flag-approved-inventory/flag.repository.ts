import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { ID } from '../../common';
import { DatabaseService } from '../../core';

@Injectable()
export class FlagRepository {
  constructor(private readonly db: DatabaseService) {}

  async isFlagged(id: ID, approvedInventory: boolean): Promise<boolean> {
    const result = await this.db
      .query()
      .match([node('project', { id, approvedInventory})])
      .return('project')
      .first();
    return result ? true : false;
  }

  async add(id: ID): Promise<void> {
    await this.db
      .query()
      .match([node('project', { id })])
      .setValues({
      'project.approvedInventory': true
      })
      .run();
  }

  async remove(id: ID): Promise<void> {
    await this.db
      .query()
      .match([node('project', { id })])
      .setValues({
        'project.approvedInventory': false
      })
      .run();
  }
}
