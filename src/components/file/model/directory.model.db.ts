import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbDirectory extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = 'DbDirectory';
  name: any = null;
  createdBy: any = null;
  parent: any = null;
}
