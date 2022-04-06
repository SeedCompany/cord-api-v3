import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbPeriodicReport extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.PeriodicReport;
  type: any = null;
  start: any = null;
  end: any = null;
  receivedDate: any = null;
  directory: any = null;
  pnp: any = null;
  skippedReason: any = null;
}
