import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbBudget extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = 'DbBudget';
  universalTemplateFile: any = null;
  records: any = null;
  status: any = null;
}
