import { DbBaseNodeLabel } from '../../../common';

export class DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className: DbBaseNodeLabel;
  id: any = null;
  createdOn: any = null;
  canDelete = false;
}
