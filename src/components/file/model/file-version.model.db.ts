import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbFileVersion extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.FileVersion;
  name: any = null;
  createdBy: any = null;
  parent: any = null;
  mimeType: any = null;
  size: any = null;
}
