import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbUnavailability extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = 'DbUnavailability';
  description: any = null;
  end: any = null;
  start: any = null;
}
