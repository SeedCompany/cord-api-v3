import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbComment extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className: DbBaseNodeLabel.Comment;
  creator: any = null;
  body: any = null;
  modifiedAt: any = null;
}
