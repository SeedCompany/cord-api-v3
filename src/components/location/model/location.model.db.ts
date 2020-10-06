import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbLocation extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = 'DbLocation';
  name: any = null;
  type: any = null;
  sensitivity: any = null;
  iso31663: any = null;
  fundingAccount: any = null;
}
