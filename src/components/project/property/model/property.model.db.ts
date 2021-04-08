import { DbBaseNodeLabel } from '../../../../common';
import { DbBaseNode } from '../../../authorization/model/db-base-node.model';

export class DbProperty extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.Property;
  value: any = null;
}
