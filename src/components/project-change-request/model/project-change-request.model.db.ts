// wip: types will be added later

import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbProjectChangeRequest extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.ProjectChangeRequest;
  types: any = null;
  summary: any = null;
  status: any = null;
  reviewers: any = null;
}
