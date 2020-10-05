import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbBudgetRecord extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = 'DbBudgetRecord';
  amount: any = null;
  fiscalYear: any = null;
  organization: any = null;
}
