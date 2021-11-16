import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbPartner extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.Partner;
  organization: any = null;
  pointOfContact: any = null;
  types: any = null;
  financialReportingTypes: any = null;
  pmcEntityCode: any = null;
  globalInnovationsClient: any = null;
  active: any = null;
  address: any = null;
  modifiedAt: any = null;
  posts: any = null;
}
