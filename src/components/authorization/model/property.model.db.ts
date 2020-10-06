import { DateTime } from 'luxon';
import { DbPermission } from './permission.model.db';

export class DbProperty {
  value: string | boolean | DateTime; // todo: make complete
  type: 'string' | 'boolean' | 'DateTime'; // todo: make complete
  permission: DbPermission;
}
