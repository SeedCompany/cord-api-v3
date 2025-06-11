import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { type ID } from '~/common';
import { DatabaseService, DbTraceLayer } from '~/core/database';
import { currentUser } from '~/core/database/query';

@Injectable()
@DbTraceLayer.applyToClass()
export class PinRepository {
  constructor(private readonly db: DatabaseService) {}

  async isPinned(id: ID): Promise<boolean> {
    const result = await this.db
      .query()
      .match([currentUser, relation('out', '', 'pinned'), node('node', 'BaseNode', { id })])
      .return('node')
      .first();
    return !!result;
  }

  async add(id: ID): Promise<void> {
    const createdAt = DateTime.local();
    await this.db
      .query()
      .match(node('node', 'BaseNode', { id }))
      .match(currentUser.as('currentUser'))
      .merge([node('currentUser'), relation('out', 'rel', 'pinned'), node('node')])
      .onCreate.setValues({
        'rel.createdAt': createdAt,
      })
      .run();
  }

  async remove(id: ID): Promise<void> {
    await this.db
      .query()
      .match([currentUser, relation('out', 'rel', 'pinned'), node('node', 'BaseNode', { id })])
      .delete('rel')
      .run();
  }
}
