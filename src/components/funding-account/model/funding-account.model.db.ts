import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbFundingAccount extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = 'DbFundingAccount';
  name: any = null;
  accountNumber: any = null;
}
