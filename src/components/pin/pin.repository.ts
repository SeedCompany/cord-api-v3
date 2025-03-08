import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, Session } from '~/common';
import { DatabaseService, DbTraceLayer } from '~/core/database';
import { requestingUser } from '~/core/database/query';

@Injectable()
@DbTraceLayer.applyToClass()
export class PinRepository {
  constructor(private readonly db: DatabaseService) {}

  async isPinned(id: ID, session: Session): Promise<boolean> {
    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        relation('out', '', 'pinned'),
        node('node', 'BaseNode', { id }),
      ])
      .return('node')
      .first();
    return !!result;
  }

  async add(id: ID, session: Session): Promise<void> {
    const createdAt = DateTime.local();
    await this.db
      .query()
      .match(node('node', 'BaseNode', { id }))
      .match(requestingUser(session))
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
      .match([
        requestingUser(session),
        relation('out', 'rel', 'pinned'),
        node('node', 'BaseNode', { id }),
      ])
      .delete('rel')
      .run();
  }
}
