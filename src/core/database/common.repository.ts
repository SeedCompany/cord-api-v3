import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, isIdLike, ServerException, Session } from '../../common';
import { DatabaseService } from './database.service';

/**
 * This provides a few methods out of the box.
 */
@Injectable()
export class CommonRepository {
  constructor(protected db: DatabaseService) {}

  async checkDeletePermission(id: ID, session: Session | ID) {
    return await this.db.checkDeletePermission(id, session);
  }

  async deleteNode(objectOrId: { id: ID } | ID, changeset?: ID) {
    if (!changeset) {
      await this.db.deleteNode(objectOrId);
      return;
    }
    try {
      const id = isIdLike(objectOrId) ? objectOrId : objectOrId.id;
      await this.db
        .query()
        .match([node('node', 'BaseNode', { id })])
        .match([node('changeset', 'Changeset', { id: changeset })])
        .merge([
          node('changeset'),
          relation('out', 'rel', 'changeset'),
          node('node'),
        ])
        .setValues({ 'rel.active': true, 'rel.deleting': true })
        .run();
    } catch (e) {
      throw new ServerException('Failed to remove node in changeset', e);
    }
  }
}
