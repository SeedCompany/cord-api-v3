import { Injectable } from '@nestjs/common';
import { ID, Session } from '../../common';
import { PostgresService } from '../postgres';
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

  async deleteNode(objectOrId: { id: ID } | ID) {
    await this.db.deleteNode(objectOrId);
  }
}
