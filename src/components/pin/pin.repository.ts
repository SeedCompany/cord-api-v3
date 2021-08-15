import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, Session } from '../../common';
import { DatabaseService, matchRequestingUser } from '../../core';

@Injectable()
export class PinRepository {
  constructor(private readonly db: DatabaseService) {}

  async isPinned(id: ID): Promise<boolean> {
    const result = await this.db
      .query()
      .match([
        node('requestingUser'),
        relation('out', '', 'pinned'),
        node('node', 'BaseNode', { id }),
      ])
      .return('node')
      .first();
    return result ? true : false;
  }

  async add(id: ID): Promise<void> {
    const createdAt = DateTime.local();
    await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'BaseNode', { id })])
      .merge([
        node('requestingUser'),
        relation('out', 'rel', 'pinned'),
        node('node'),
      ])
      .onCreate.setValues({
        'rel.createdAt': createdAt,
      })
      .run();
  }

  async remove(id: ID, session: Session): Promise<void> {
    await this.db
      .query()
      .apply(matchRequestingUser(session))
      .optionalMatch([
        node('requestingUser'),
        relation('out', 'rel', 'pinned'),
        node('node', 'BaseNode', { id }),
      ])
      .delete('rel')
      .run();
  }
}
