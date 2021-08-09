import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbEngagement extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.Engagement;
  ceremony: any = null;
  completeDate: any = null;
  disbursementCompleteDate: any = null;
  endDate: any = null;
  endDateOverride: any = null;
  initialEndDate: any = null;
  lastReactivatedAt: any = null;
  lastSuspendedAt: any = null;
  startDate: any = null;
  startDateOverride: any = null;
  statusModifiedAt: any = null;
  modifiedAt: any = null;
  status: any = null;
}
