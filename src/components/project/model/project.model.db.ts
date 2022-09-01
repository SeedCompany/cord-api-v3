// wip: types will be added later

import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbProject extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.Project;
  estimatedSubmission: any = null;
  step: any = null;
  name: any = null;
  status: any = null;
  departmentId: any = null;
  mouStart: any = null;
  mouEnd: any = null;
  initialMouEnd: any = null;
  stepChangedAt: any = null;
  rootDirectory: any = null;
  member: any = null;
  otherLocations: any = null;
  primaryLocation: any = null;
  marketingLocation: any = null;
  partnership: any = null;
  budget: any = null;
  modifiedAt: any = null;
  fieldRegion: any = null;
  engagement: any = null;
  sensitivity: any = null;
  tags: any = null;
  financialReportReceivedAt: any = null;
  financialReportPeriod: any = null;
  owningOrganization: any = null;
  posts: any = null;
  presetInventory: any = null;
  commentThreads: any = null;
}
