import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbCeremony extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.Ceremony;
  actualDate: any = null;
  estimatedDate: any = null;
  planned: any = null;
  type: any = null;
}
