import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbCommentThread extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className: DbBaseNodeLabel.CommentThread;
  comments: any = null;
}
