import { DbBaseNodeLabel } from '../../../common';
import { DbBaseNode } from '../../authorization/model/db-base-node.model';

export class DbPartnership extends DbBaseNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __className = DbBaseNodeLabel.Partnership;
  agreement: any = null;
  agreementStatus: any = null;
  financialReportingType: any = null;
  mou: any = null;
  mouEnd: any = null;
  mouEndOverride: any = null;
  mouStart: any = null;
  mouStartOverride: any = null;
  mouStatus: any = null;
  types: any = null;
  organization: any = null;
  partner: any = null;
  primary: any = null;
}
