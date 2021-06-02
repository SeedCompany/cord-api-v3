import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbProductStep extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.ProductStep;
  name: any = null;
  progress: any = null;
  description: any = null;
}
