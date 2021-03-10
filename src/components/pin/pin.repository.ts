import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { Session } from '../../common';
import { DatabaseService, matchRequestingUser } from '../../core';

@Injectable()
export class PinRepository {
  constructor(private readonly db: DatabaseService) {}

  async isPinned(id: string, session: Session): Promise<boolean> {
    const result = await this.db
      .query()
      .call(matchRequestingUser, session)
      .match([
        node('requestingUser'),
        relation('out', '', 'pinned', { active: true }),
        node('node', 'BaseNode', { id }),
      ])
      .return('node')
      .first();
    return result ? true : false;
  }

  async add(id: string, session: Session): Promise<void> {
    const isPinned = await this.isPinned(id, session);
    if (isPinned) {
      return;
    }
    const createdAt = DateTime.local();
    await this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'BaseNode', { id })])
      .create([
        node('requestingUser'),
        relation('out', '', 'pinned', { active: true, createdAt }),
        node('node'),
      ])
      .run();
  }

  async remove(id: string, session: Session): Promise<void> {
    const isPinned = await this.isPinned(id, session);
    if (!isPinned) {
      return;
    }
    await this.db
      .query()
      .call(matchRequestingUser, session)
      .optionalMatch([
        node('requestingUser'),
        relation('out', 'rel', 'pinned', { active: true }),
        node('node', 'BaseNode', { id }),
      ])
      .delete('rel')
      .run();
  }
}
