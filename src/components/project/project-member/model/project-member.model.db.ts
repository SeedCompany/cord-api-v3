import { DbBaseNode } from '../../../authorization/model/db-base-node.model';

export class DbProjectMember extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = 'DbProjectMember';
  roles: any = null;
  user: any = null;
  modifiedAt: any = null;
}
