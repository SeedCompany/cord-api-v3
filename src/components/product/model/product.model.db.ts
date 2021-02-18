import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbProduct extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.Product;
  mediums: any = null;
  methodology: any = null;
  purposes: any = null;
  scriptureReferences: any = null;
  produces: any = null;
  scriptureReferencesOverride: any = null;
  isOverriding: any = null;
  canDelete: any = null;
}
